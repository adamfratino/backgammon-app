"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Badge,
  Button,
  Group,
  Select,
  Slider,
  Stack,
  Text,
  Toggle,
  ToggleGroup,
} from "@uiid/design-system";
import { RefreshCcwIcon } from "@uiid/design-system/icons";

import {
  ANY_CUBE_VALUE,
  CRAWFORD_FILTERS,
  cubeValueLadder,
  filtersFrom,
  KIND_FILTERS,
  SEVERITY_BANDS,
  SEVERITY_COLOR,
  SORTS,
  sortFrom,
  type CubeValueRange,
  viewParams,
  SECONDARY_SIDEBAR_MAXWIDTH,
} from "@/lib/constants";

interface BlunderFilterPanelProps {
  category: string;
  /** The highest face in the data, which is where the Cube value track stops. */
  topCubeValue: number;
}

// Select keys a row by `value`, the constants by `id`.
const KIND_ITEMS = KIND_FILTERS.map(({ id, label }) => ({ value: id, label }));

/**
 * Each state with a line saying what it means for the cube, a size smaller and a
 * shade back, so the popup reads as choices with notes rather than two competing
 * lines.
 *
 * Drawn through `children` rather than the DS `description` slot, for the same
 * reason the severity rows are: the slot wraps the pair in a block that carries
 * its own bottom margin whenever a description is present, which pads every row
 * apart, and it colors the second line with `--list-description-color` — which
 * resolves to the value the label already draws in, so the "description" comes
 * out no dimmer than the name above it. `label` stays a plain string because it
 * is still what the closed trigger shows and what typeahead matches. Raised
 * upstream as UI-218.
 */
const CRAWFORD_ITEMS = CRAWFORD_FILTERS.map(({ id, label, description }) => ({
  value: id,
  label,
  children: (
    <Stack gap={0}>
      <Text size={0}>{label}</Text>
      <Text size={-1} shade="halftone">
        {description}
      </Text>
    </Stack>
  ),
}));

/**
 * Each band beside the slice of the error scale it covers, in the same badge the
 * table's Error column draws, so a severity is the same color in the filter as
 * in the list it filters. The bands run high to low, so a band stops a
 * thousandth short of the one above it and the top band is open-ended — the
 * upper bound is read off the next band's floor rather than written out a second
 * time, where it could drift from `min`.
 *
 * `children` draws the row in place of the label, which stays a plain string
 * because it is also what the closed trigger reads back: the popup shows
 * "Catastrophic 0.400+" in red, the trigger still shows "Catastrophic".
 */
const SEVERITY_ITEMS = SEVERITY_BANDS.map(({ id, label, min }, index) => {
  const above = SEVERITY_BANDS[index - 1]?.min;
  const range =
    above === undefined ? `${min.toFixed(3)}+` : `${min.toFixed(3)}–${(above - 0.001).toFixed(3)}`;

  return {
    value: id,
    label,
    children: (
      <>
        <Text size={0}>{label}</Text>
        <Badge color={SEVERITY_COLOR[id]}>{range}</Badge>
      </>
    ),
  };
});

interface ResetButtonProps {
  filter: string;
  disabled: boolean;
  onClick: () => void;
}

/**
 * The reset for one filter, drawn in the label row opposite its label. Disabled
 * rather than dropped while there is nothing to reset, so the row keeps its
 * height and the controls below it never shift as filters come and go.
 */
function ResetButton({ filter, disabled, onClick }: ResetButtonProps) {
  const reset = `Reset ${filter.toLowerCase()}`;

  return (
    <Button
      variant="ghost"
      size="xsmall"
      shape="square"
      tooltip={reset}
      aria-label={reset}
      disabled={disabled}
      onClick={onClick}
    >
      <RefreshCcwIcon />
    </Button>
  );
}

interface FilterSelectProps {
  label: string;
  placeholder: string;
  items: { value: string; label: string; children?: React.ReactNode }[];
  value: string[];
  onValueChange: (values: string[]) => void;
}

/**
 * A dropdown under its own label row, which carries a reset for just this
 * dropdown. Both sit in the Field the design system draws around the control:
 * `label` on the left of the row, `action` on the right. The popup opens below
 * the trigger rather than over it, leaving the picks in view, where nothing clips
 * the options.
 */
function FilterSelect({ label, value, onValueChange, ...props }: FilterSelectProps) {
  return (
    <Select
      {...props}
      label={label}
      action={
        <ResetButton
          filter={label}
          disabled={value.length === 0}
          onClick={() => onValueChange([])}
        />
      }
      multiple
      fullwidth
      value={value}
      onValueChange={onValueChange}
      size="small"
      PositionerProps={{ alignItemWithTrigger: false }}
    />
  );
}

interface CubeValueFilterProps {
  /** The faces the track steps through, lowest first. At least two of them. */
  ladder: number[];
  value: CubeValueRange;
  onValueChange: (cubeValue: CubeValueRange) => void;
}

interface FaceSelectProps {
  label: string;
  ladder: number[];
  /** Which stop on the ladder this end currently sits on. */
  position: number;
  /** Stops this end may take; the rest would cross the other end. */
  allows: (position: number) => boolean;
  onPick: (position: number) => void;
}

/**
 * One end of the range as a list of faces. It is addressed by position on the
 * ladder rather than by the face itself, so it speaks the coordinate the slider
 * beside it moves in and the two can be set from the same pair of numbers.
 *
 * A face that would put this end past the other one is listed but disabled,
 * rather than dropped: the list keeps its length as the other end moves, so the
 * row a face sits on doesn't shift under the pointer between openings.
 */
function FaceSelect({ label, ladder, position, allows, onPick }: FaceSelectProps) {
  return (
    <Select
      label={label}
      fullwidth
      size="small"
      value={String(position)}
      onValueChange={(next) => onPick(Number(next))}
      items={ladder.map((face, stop) => ({
        value: String(stop),
        label: String(face),
        disabled: !allows(stop),
      }))}
      PositionerProps={{ alignItemWithTrigger: false }}
    />
  );
}

/**
 * The cube value as a span of the cube's own faces: a track to sweep both ends
 * at once, and a list under each end to name it exactly. All three read and
 * write one range, so moving a thumb re-reads the lists and picking from a list
 * moves a thumb.
 *
 * The slider moves through positions on the ladder rather than through the faces
 * themselves, so 1 to 2 is the same drag as 32 to 64 and the stops stay evenly
 * spaced; the readout beside it names the faces those positions stand for.
 *
 * An end parked on the end of the ladder is no bound at all rather than a bound
 * at that face. That keeps the range honest as the data grows: a link saved while
 * the track stopped at 4 asks for "2 and up", not "2 to 4", so a cube turned to 8
 * next month falls inside it rather than just outside.
 */
function CubeValueFilter({ ladder, value, onValueChange }: CubeValueFilterProps) {
  const end = ladder.length - 1;

  // The slider counts in positions, but nothing a reader sees or hears should: a
  // position is a 0 or a 2 that is on no cube. Every way out of this component
  // goes through here, so it can only ever report a real face.
  const faceAt = (position: number) => ladder[position] ?? 1;

  // The track carries every face the URL can name — `cubeValueLadder` is asked for
  // one that reaches the bounds as well as the data — so a bound always finds its
  // position.
  const asked = [
    value.min === null ? 0 : ladder.indexOf(value.min),
    value.max === null ? end : ladder.indexOf(value.max),
  ];

  // Both ends are driven from here rather than straight off the URL. Reading them
  // from the URL means every step of a drag has to be written to it first, and a
  // `router.push` per pointer move is a server round trip per pointer move: the
  // thumb stops following the pointer and starts lagging behind it, landing
  // wherever the last navigation to resolve says it should. Dragging this track
  // end to end cost eight navigations that way; it costs one now.
  const [held, setHeld] = useState(asked);

  // Anything that moves the range without touching this filter — the reset, the
  // back button, a link — changes the URL under us, so the controls follow it.
  // Comparing during the render keeps them in step without a pass through the DOM.
  const [seen, setSeen] = useState(asked.join());
  if (seen !== asked.join()) {
    setSeen(asked.join());
    setHeld(asked);
  }

  const [low = 0, high = end] = held;

  // Moves all three at once, then writes the range the URL has to carry.
  function commit(lowest: number, highest: number) {
    setHeld([lowest, highest]);
    onValueChange({
      min: lowest === 0 ? null : faceAt(lowest),
      max: highest === end ? null : faceAt(highest),
    });
  }

  return (
    <Group gap={3} fullwidth>
      <Stack fullwidth ax="stretch">
        <Slider
          label="Cube value"
          action={
            <ResetButton
              filter="Cube value"
              disabled={value.min === null && value.max === null}
              onClick={() => {
                setHeld([0, end]);
                onValueChange(ANY_CUBE_VALUE);
              }}
            />
          }
          fullwidth
          size="small"
          min={0}
          max={end}
          value={held}
          // Every step of the drag, which only has to move the controls.
          onValueChange={(next) => setHeld(typeof next === "number" ? [next] : [...next])}
          // Once, when the thumb is let go. This is the one that reaches the URL.
          onValueCommitted={(next) => {
            const [lowest = 0, highest = end] = typeof next === "number" ? [next] : next;
            commit(lowest, highest);
          }}
          ValueProps={{
            // Both ends on one face reads as that face rather than as a span from it
            // to itself, which is what a set of the two gives for free.
            children: (_, thumbs) => [...new Set(thumbs.map(faceAt))].join("–"),
          }}
          ThumbProps={{
            // Each thumb otherwise announces its position on the track, so a reader
            // using a screen reader hears a 0 where the readout beside it says 1.
            // Base UI's own wording for which end of the span a thumb holds is kept.
            getAriaValueText: (_, position, index) =>
              `${faceAt(position)} ${index === 0 ? "start" : "end"} range`,
          }}
        />
      </Stack>
      <Group gap={1.5}>
        <FaceSelect
          label="Min"
          ladder={ladder}
          position={low}
          allows={(stop) => stop <= high}
          onPick={(stop) => commit(stop, high)}
        />
        <FaceSelect
          label="Max"
          ladder={ladder}
          position={high}
          allows={(stop) => stop >= low}
          onPick={(stop) => commit(low, stop)}
        />
      </Group>
    </Group>
  );
}

/**
 * A sidebar of fixed width, so ticking never changes the table's width; a long
 * list of picks truncates instead. Nothing ticked in a dropdown means nothing
 * is filtered out, so the empty state says "All" rather than looking unset.
 * Every change goes through `viewParams`, which writes no `?page=`, so the list
 * starts again at page 1.
 */
export function BlunderFilterPanel({ category, topCubeValue }: BlunderFilterPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = filtersFrom(searchParams);
  const sort = sortFrom(searchParams.get("sort"));

  // The track covers the data, and also whatever a hand-written URL asks about,
  // so a face nobody has reached yet still parks its end where it says it is
  // rather than somewhere the reader has to guess at.
  const ladder = cubeValueLadder(
    Math.max(topCubeValue, filters.cubeValue.min ?? 1, filters.cubeValue.max ?? 1),
  );

  function show(params: URLSearchParams) {
    const query = params.toString();
    router.push(query ? `/${category}?${query}` : `/${category}`);
  }

  // Select hands back the values in the order they were ticked, so they go
  // through `filtersFrom` to come out in the constants' order, like the server's.
  function pick(param: "kind" | "severity" | "crawford", values: string[]) {
    const params = new URLSearchParams(searchParams);
    params.delete(param);
    for (const value of values) params.append(param, value);
    show(viewParams(filtersFrom(params), sort));
  }

  return (
    <Stack w={SECONDARY_SIDEBAR_MAXWIDTH} gap={6} ax="stretch">
      {/* A sort is always set, so pressing the pressed one again changes nothing. */}
      <ToggleGroup
        aria-label="Sort"
        fullwidth
        value={[sort]}
        onValueChange={([next]) => next && show(viewParams(filters, sortFrom(next)))}
        size="small"
      >
        {SORTS.map(({ id, label }) => (
          <Toggle key={id} value={id}>
            {label}
          </Toggle>
        ))}
      </ToggleGroup>

      <FilterSelect
        label="Kind"
        placeholder="All kinds"
        items={KIND_ITEMS}
        value={filters.kinds}
        onValueChange={(values) => pick("kind", values)}
      />
      <FilterSelect
        label="Severity"
        placeholder="All severities"
        items={SEVERITY_ITEMS}
        value={filters.severities}
        onValueChange={(values) => pick("severity", values)}
      />
      <FilterSelect
        label="Crawford"
        placeholder="All games"
        items={CRAWFORD_ITEMS}
        value={filters.crawfords}
        onValueChange={(values) => pick("crawford", values)}
      />
      <CubeValueFilter
        ladder={ladder}
        value={filters.cubeValue}
        onValueChange={(cubeValue) => show(viewParams({ ...filters, cubeValue }, sort))}
      />
    </Stack>
  );
}
