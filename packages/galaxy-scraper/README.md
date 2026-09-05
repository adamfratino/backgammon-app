# @repo/galaxy-scraper

Pulls your Backgammon Galaxy blunder analysis into a local SQLite database.

Galaxy has no export feature at any membership tier, but the web client reads
its blunder log from a JSON API. This package replays those requests with your
own bearer token, caches the raw responses, and normalises them into queryable
tables.

Zero runtime dependencies — it uses Node 24's built-in `fetch`, `node:sqlite`,
and native TypeScript type stripping.

## Setup

Grab a bearer token from the browser:

1. Open <https://www.backgammongalaxy.com> logged in, then DevTools → Network.
2. Filter to Fetch/XHR and open your Blunders page so a request fires.
3. Click a `blunder/category/...` request → Headers → copy the `authorization`
   value (without the `Bearer ` prefix).

Save it to `.token` in this package (gitignored), or export `GALAXY_TOKEN`:

```bash
echo '<token>' > packages/galaxy-scraper/.token
chmod 600 packages/galaxy-scraper/.token
```

Tokens last about 13 days. The CLI reports the remaining lifetime on startup
and refuses to run once expired.

## Usage

```bash
pnpm --filter @repo/galaxy-scraper categories   # list categories and counts
pnpm --filter @repo/galaxy-scraper all          # scrape everything, then load
pnpm --filter @repo/galaxy-scraper stats        # summarise the database
pnpm --filter @repo/galaxy-scraper verify       # check the XGID converter
```

| Option                  | Effect                                              |
| ----------------------- | --------------------------------------------------- |
| `--category=blitz,race` | Limit to specific categories                        |
| `--delay=1000`          | Milliseconds between requests (default 1000)        |
| `--resume`              | Reuse pages already in `raw/` instead of refetching |
| `--include-recent`      | Include the cross-cutting `recent` category         |
| `--max-pages=100`       | Safety cap per category                             |
| `--db=<path>`           | Database location                                   |

`scrape` writes raw pages to `raw/<category>/page-NNN.json`; `load` builds the
database from whatever is cached. Because the two are separate, a token expiry
mid-scrape never costs you the pages already downloaded, and `load` re-runs
offline as often as you like.

## How a blunder is assembled

The API returns flat `events`, several of which share one `blunder_id`:

- **Checker blunders** pair a `dice_rolled` event (the roll, plus cube
  analysis for that position) with a `move_commited` event (the ranked
  candidate move list).
- **Cube blunders** arrive either on the `dice_rolled` event or standalone as
  `double_requested`, `double_accepted`, or `double_rejected`.
- A single blunder can be flagged on **both** sides — a wrong cube followed by
  a wrong play. Those are stored as `kind = 'both'` with the cube error kept in
  its own `cube_*` columns rather than being overwritten.

Two gotchas worth knowing if you query the raw JSON directly:

- `error_analysis.equity_error` is `0.0` on every record Galaxy returns, so it
  is discarded rather than stored. The real magnitude lives in `raw_error`
  (negative), which is what `blunders.raw_error` holds — populated on every
  row, never zero. `error_magnitude` is its absolute value, for sorting.
  Per-candidate `candidate_moves.equity_error` is a different, genuinely
  populated field: it is zero only for the rank-1 move, which by definition
  has no error.
- `source_position.classification` (the position's own tag, e.g. `6_prime`)
  does not always match the API category it was listed under (`six_prime`).
  Both are stored — the latter in `blunder_categories`.
- The candidate list is truncated around the move you played, so `played_rank`
  is only ever 2 or 3 and `candidate_count` tops out at 5. It is not the engine's
  full move ranking.

## Schema

| Table                | Contents                                                                                                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `matches`            | One row per match: date, length, final score, opponent name. `self_*` is resolved against the token's `bg_id`, so it is correct whether you were player1 or player2.                           |
| `blunders`           | One row per `blunder_id`: category, kind, dice, error magnitude, equity, match score, Crawford state, cube value and ownership, `source_xgid`, GNU BG position/match ID, played vs. best move. |
| `candidate_moves`    | Every ranked alternative: notation, equity, error, `move_played` flag, and both `xgid` and `gnubgid` for the resulting position.                                                               |
| `cube_decisions`     | Full cube equities: no-double / double-take / double-pass, plus best action for each side.                                                                                                     |
| `blunder_categories` | Which API categories a blunder was listed under.                                                                                                                                               |

## Board state

Galaxy only ever hands out an XGID for the positions that _result_ from each
candidate move — never for the position you actually faced. `position.ts`
closes that gap by decoding GNU BG's position and match IDs and re-encoding
them as an XGID, stored as `blunders.source_xgid`. Paste it straight into
eXtreme Gammon or GNU BG to load the position.

The decoding is not guesswork. Galaxy returns both a `gnubgid` and an `xgid`
for every candidate move, which gives 4,304 known-good pairs; `pnpm verify`
round-trips all of them and currently matches 100%. What that pinned down:

- The board is 26 characters: index 0 is the lower player's bar, 1-24 are
  points numbered from the upper player's side, 25 is the upper player's bar.
- gnubg writes a centred cube as owner `3`; XG writes `0`, or `±1` for an owner.
- The two scores appear in the opposite order to gnubg's match id.
- The trailing field is cube availability, which is `0` during the Crawford
  game because the cube is dead.

For a checker blunder the source XGID carries the actual roll, because the
`move_commited` review's match id encodes the dice. A cube blunder's source is
pre-roll, so its dice read `00` — which is correct for a cube decision.

## Example queries

```sql
-- Worst checker errors, most expensive first
SELECT b.error_magnitude, b.source_classification, b.played_notation,
       b.best_notation, b.gnubg_id, m.opponent_name, m.finished_at
FROM blunders b JOIN matches m USING (match_id)
WHERE b.kind IN ('checker', 'both')
ORDER BY b.error_magnitude DESC LIMIT 25;

-- Which cube action costs the most?
SELECT cube_action, COUNT(*) AS n, ROUND(AVG(error_magnitude), 4) AS avg_error
FROM blunders WHERE kind IN ('cube', 'both')
GROUP BY cube_action ORDER BY avg_error DESC;

-- Where you bleed the most equity overall, not just per blunder
SELECT source_classification, COUNT(*) AS blunders,
       ROUND(SUM(error_magnitude), 2) AS total_lost,
       ROUND(AVG(error_magnitude), 4) AS avg_lost
FROM blunders GROUP BY source_classification ORDER BY total_lost DESC;
```

## Notes

Galaxy's terms prohibit reverse engineering and bots during gameplay, and are
silent on reading your own history. The client throttles to one request per
second by default; leave it there.
