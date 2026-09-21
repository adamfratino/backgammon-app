"use client";

import {
  SegmentedBar,
  type InteractiveSegmentedBarProps,
} from "@microcharts/react/segmented-bar/interactive";

import "@microcharts/react/motion";

const SHARE_WIDTH = 320;
const SHARE_HEIGHT = 38;

interface ShareBarProps extends Pick<
  InteractiveSegmentedBarProps,
  "data" | "maxSegments" | "colors"
> {}

export function ShareBar({ data, maxSegments, colors }: ShareBarProps) {
  return (
    <SegmentedBar
      animate
      data={data}
      maxSegments={maxSegments}
      order="data"
      colors={colors}
      label="none"
      width={SHARE_WIDTH}
      height={SHARE_HEIGHT}
      style={{ width: "100%" }}
    />
  );
}
