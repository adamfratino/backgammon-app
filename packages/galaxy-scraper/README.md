# @repo/galaxy-scraper

Pulls your Backgammon Galaxy matches, and the blunders in them, into a local SQLite database.

Galaxy has no export feature at any membership tier, but the web client reads your match history, each match, and a review of every decision in it from a JSON API. This package replays those requests with your own bearer token, caches the raw responses, and normalises them into queryable tables.

Zero runtime dependencies — it uses Node 24's built-in `fetch`, `node:sqlite`, and native TypeScript type stripping.

## Usage

From the repo root:

```bash
pnpm blunders
```

That logs in if it has to, then fetches only the matches Galaxy has finished since the last sync: one request for the 50 newest match ids says whether there is anything new, and each new match costs one request for the match and one per game for its reviews, plus one more to find the end. The first run, and `pnpm blunders --full`, walk the whole match history instead (every match back to November 2025, about 1,400 of them, so allow well over an hour). A run that finds all 50 newest ids unknown does the same, since the gap may reach further back than those 50. The first run also walks you through the login:

1. Open <https://www.backgammongalaxy.com/play> logged in and open the DevTools console (⌥⌘J in Chrome, ⌥⌘C in Safari). If Chrome asks, type `allow pasting` once.
2. Paste. The CLI has already put the snippet from `src/console-snippet.js` on your clipboard; it reads your session tokens out of the page and copies them back to the clipboard. Nothing leaves the browser.
3. Paste into the terminal and press Enter. The paste is not echoed.

The tokens are saved to `.auth.json` in `data/`, beside the database (gitignored, mode 600). Both tokens last about nine days. When the snippet also finds the refresh token, the CLI renews the pair on every run, which rolls that window forward, so running at least once every nine days or so means you never paste again. You only repeat the paste if you leave it long enough for the refresh token to lapse too. Either way it reports the remaining lifetimes on every run.

`GALAXY_TOKEN` in the environment, or a bare access token in a `.token` file, still work for the non-interactive case.

Other commands:

```bash
pnpm --filter @repo/galaxy-scraper login        # re-capture tokens, e.g. after switching accounts
pnpm --filter @repo/galaxy-scraper load         # rebuild the database from the matches cached in raw/
pnpm --filter @repo/galaxy-scraper stats        # summarise the database
pnpm --filter @repo/galaxy-scraper verify       # check the XGID converter
```

| Option         | Effect                                               |
| -------------- | ---------------------------------------------------- |
| `--full`       | Walk the whole match history, not just the newest 50 |
| `--delay=1000` | Milliseconds between requests (default 1000)         |
| `--db=<path>`  | Database location                                    |

Every match is cached, with its reviews, as `data/raw/matches/<match_id>.json`, and a cached match is never fetched again. So a backfill stopped halfway, by a token expiry or anything else, picks up where it left off, and `load` rebuilds the database offline as often as you like. A match Galaxy hasn't analysed yet is neither cached nor stored, so the next run asks for it again.

## Where everything comes from

Every route lives on `https://api.backgammongalaxy.com` and takes the web client's headers:

| Route                                                        | Gives                                                                                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /stats/api/v3/users/analytics/results/{bg_id}?limit=50` | The 50 newest match ids, strictly newest first. `limit` goes no higher.                                                                                                   |
| `GET /stats/api/v2/analyses/list/{page}`                     | The history page, 30 matches a page, with opponents' names. Loose order within a page, and it leaves out a few matches, so it's an index rather than the source of truth. |
| `GET /api/matches/{id}`                                      | The match: length, score, date, each player's error rate. No names. With `accept: application/vnd.galaxy+mat`, the match as a `.mat` file, names included.                |
| `GET /match-analytics/api/v1/game_reviews/{id}/{game}`       | One game's events, each with the engine's review. 1-based; a game past the last has no events.                                                                            |

## How a blunder is assembled

A game's events are every decision by both players, each reviewed. A blunder is one of mine the review flags with `is_blunder`, grouped the way Galaxy's blunder service listed them:

- **Checker blunders** pair a `dice_rolled` event (the roll, plus cube analysis for that position) with the `move_commited` event after it (the ranked candidate move list).
- **Cube blunders** arrive either on the `dice_rolled` event (a missed double) or standalone as `double_requested`, `double_accepted`, or `double_rejected`. A missed double followed by a turn lost on time pairs `dice_rolled` with `turn_forfeited`.
- A single blunder can be flagged on **both** sides — a wrong cube followed by a wrong play. Those are stored as `kind = 'both'` with the cube error kept in its own `cube_*` columns rather than being overwritten.

A blunder is keyed on the id of its first review, which grows through a match, so ids sort in play order. Its category is its position's own classification, with the one name the app spells differently (`6_prime` is `six_prime`).

Some things worth knowing if you query the raw JSON directly:

- Each review's analysis sits one level down, at `review.result.result`, beside the kind of decision it analysed.
- `error_analysis.equity_error` is null or `0.0`, so it is discarded rather than stored. The real magnitude lives in `raw_error` (negative), which is what `blunders.raw_error` holds. `error_magnitude` is its absolute value, for sorting. Per-candidate `candidate_moves.equity_error` is a different, genuinely populated field: it is zero only for the rank-1 move, which by definition has no error.
- The candidate list is truncated around the move you played, so it is not the engine's full move ranking.

## Schema

| Table                | Contents                                                                                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `matches`            | One row per match, clean ones included: date, length, final score, both error rates, opponent name. `self_*` is resolved against the token's `bg_id`, so it is correct whether you were player1 or player2. |
| `blunders`           | One row per `blunder_id`: category, kind, dice, error magnitude, equity, match score, Crawford state, cube value and ownership, `source_xgid`, GNU BG position/match ID, played vs. best move.              |
| `candidate_moves`    | Every ranked alternative: notation, equity, error, `move_played` flag, and both `xgid` and `gnubgid` for the resulting position.                                                                            |
| `cube_decisions`     | Full cube equities: no-double / double-take / double-pass, plus best action for each side.                                                                                                                  |
| `blunder_categories` | The category each blunder is listed under.                                                                                                                                                                  |

## Board state

Galaxy only ever hands out an XGID for the positions that _result_ from each candidate move — never for the position you actually faced. `position.ts` closes that gap by decoding GNU BG's position and match IDs and re-encoding them as an XGID, stored as `blunders.source_xgid`. Paste it straight into eXtreme Gammon or GNU BG to load the position.

The decoding is not guesswork. Galaxy returns both a `gnubgid` and an `xgid` for every candidate move, which gives 4,304 known-good pairs; `pnpm verify` round-trips all of them and currently matches 100%. What that pinned down:

- The board is 26 characters: index 0 is the lower player's bar, 1-24 are points numbered from the upper player's side, 25 is the upper player's bar.
- gnubg writes a centred cube as owner `3`; XG writes `0`, or `±1` for an owner.
- The two scores appear in the opposite order to gnubg's match id.
- The trailing field is cube availability, which is `0` during the Crawford game because the cube is dead.

For a checker blunder the source XGID carries the actual roll, because the `move_commited` review's match id encodes the dice. A cube blunder's source is pre-roll, so its dice read `00` — which is correct for a cube decision.

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

Galaxy's terms prohibit reverse engineering and bots during gameplay, and are silent on reading your own history. The client throttles to one request per second by default; leave it there.
