import { gnubgIdToXgid } from "./position.ts";
import { readRawPages } from "./scrape.ts";

const FIELDS = [
  "board",
  "cube",
  "cubePos",
  "turn",
  "dice",
  "score1",
  "score2",
  "crawford",
  "matchLen",
  "maxCube",
];

export interface VerifyReport {
  total: number;
  exact: number;
  mismatchesByField: { field: string; count: number; got: string; want: string; gnubgid: string }[];
}

/**
 * Galaxy supplies both a gnubg id and an XGID for every candidate move, which
 * gives us thousands of known-good pairs to check the converter against.
 */
export function verifyConverter(): VerifyReport {
  const pairs: { gnubgid: string; xgid: string }[] = [];

  for (const { payload } of readRawPages()) {
    for (const event of payload?.data?.events ?? []) {
      for (const review of event.event?.reviews ?? []) {
        for (const move of review.result?.moves ?? []) {
          if (move.final?.gnubgid && move.final?.xgid) {
            pairs.push({ gnubgid: move.final.gnubgid, xgid: move.final.xgid });
          }
        }
      }
    }
  }

  const counts = new Map<string, number>();
  const examples = new Map<string, { got: string; want: string; gnubgid: string }>();
  let exact = 0;

  for (const { gnubgid, xgid } of pairs) {
    const produced = gnubgIdToXgid(gnubgid);
    if (produced === xgid) {
      exact++;
      continue;
    }
    const got = (produced ?? "").replace(/^XGID=/, "").split(":");
    const want = xgid.replace(/^XGID=/, "").split(":");
    for (let i = 0; i < FIELDS.length; i++) {
      const field = FIELDS[i] as string;
      if (got[i] !== want[i]) {
        counts.set(field, (counts.get(field) ?? 0) + 1);
        if (!examples.has(field)) {
          examples.set(field, { got: got[i] ?? "", want: want[i] ?? "", gnubgid });
        }
      }
    }
  }

  return {
    total: pairs.length,
    exact,
    mismatchesByField: [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([field, count]) => ({ field, count, ...examples.get(field)! })),
  };
}
