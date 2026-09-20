import { defineTheme } from "@microcharts/react/theme";

/**
 * Microcharts, wearing the design system's colours.
 *
 * The library keeps every colour in a `--mc-*` custom property, so a theme is
 * just a set of those — which means the values can be `var()` references to the
 * uiid tokens rather than hexes copied out of them. A token that moves in the
 * design system moves in the charts, with nothing here to update.
 *
 * That is also why derivation is off. `defineTheme` will build a whole
 * harmonised palette from one accent, but only by computing on a real colour,
 * and a `var()` is a string it cannot do arithmetic on. Deriving would mean
 * pinning hexes here and letting them drift out of step with the tokens beside
 * them — a worse trade than naming the few colours the charts actually use.
 *
 * Dark is off for the same reason and one more: the design system ships no dark
 * scheme at all, so there is nothing for a dark twin to match. The day it gains
 * one, these `var()`s follow it on their own.
 *
 * Red rather than the interface accent: every one of these charts measures
 * something that went wrong, and equity given up is not a neutral quantity. It
 * is the same red the Catastrophic badge wears.
 */
export const chartTheme = defineTheme({
  accent: "var(--color-red-600)",
  neutral: "var(--color-neutral-400)",
  stroke: "var(--color-neutral-800)",
  band: "var(--color-neutral-200)",
  surface: "var(--shade-surface)",
  surfaceInk: "var(--palette-text)",
  surfaceEdge: "var(--color-neutral-300)",
  derive: false,
  dark: false,
});
