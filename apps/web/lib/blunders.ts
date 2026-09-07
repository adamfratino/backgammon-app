export const KINDS = ["checker", "cube", "both"] as const;

export type BlunderKind = (typeof KINDS)[number];
