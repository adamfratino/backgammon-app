export const PER_PAGE = 50;

/** No `both`: the query splits one of those into a checker decision and a cube decision. */
export const KINDS = ["checker", "cube"] as const;

export type BlunderKind = (typeof KINDS)[number];

export const KIND_LABELS: Record<BlunderKind, string> = {
  checker: "Checker plays",
  cube: "Cube decisions",
};

export const SEVERITY_BANDS = [
  { id: "catastrophic", label: "Catastrophic", min: 0.4 },
  { id: "severe", label: "Severe", min: 0.2 },
  { id: "moderate", label: "Moderate", min: 0.1 },
  { id: "mild", label: "Mild", min: 0 },
] as const;

export type BlunderSeverity = (typeof SEVERITY_BANDS)[number]["id"];

export function severityOf(errorMagnitude: number): BlunderSeverity {
  const band = SEVERITY_BANDS.find(({ min }) => errorMagnitude >= min);
  return band?.id ?? "mild";
}

export const CUBE_ACTION = [
  "double_accepted",
  "double_requested",
  "double_rejected",
  "dice_rolled",
] as const;

export type BlunderCubeAction = (typeof CUBE_ACTION)[number] | null;

export const CUBE_DIRECTIONS = [
  { id: "offer", label: "Offering the cube" },
  { id: "receive", label: "Being offered the cube" },
] as const;

export type CubeDirection = (typeof CUBE_DIRECTIONS)[number]["id"];

export function cubeDirection(direction: BlunderCubeAction): CubeDirection {
  if (direction === "double_accepted" || direction === "double_rejected") return "receive";
  return "offer";
}

/** The ids on their own: the filter validates against these, and so does the router. */
export const SEVERITIES = SEVERITY_BANDS.map(({ id }) => id);
export const DIRECTIONS = CUBE_DIRECTIONS.map(({ id }) => id);

/** An empty group means no filter on it, so this is also what "unfiltered" looks like. */
export interface BlunderFilters {
  kinds: BlunderKind[];
  severities: BlunderSeverity[];
  directions: CubeDirection[];
}

/** `?page=` is whatever was in the URL bar, so anything that isn't a page is page 1. */
export function pageFrom(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/**
 * The filters, read from `?kind=&severity=&direction=`. Anything that isn't one
 * of ours is dropped, and each group comes back in the constants' own order —
 * which is what lets the browser and the server build the same cache key from
 * the same URL. Takes anything with `getAll`, so the read-only search params in
 * the browser and a plain `URLSearchParams` on the server both fit.
 */
export function filtersFrom(params: Pick<URLSearchParams, "getAll">): BlunderFilters {
  const pick = <T extends string>(key: string, allowed: readonly T[]): T[] => {
    const chosen = new Set(params.getAll(key));
    return allowed.filter((value) => chosen.has(value));
  };

  return {
    kinds: pick("kind", KINDS),
    severities: pick("severity", SEVERITIES),
    directions: pick("direction", DIRECTIONS),
  };
}
