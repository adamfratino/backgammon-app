"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Field,
  Group,
  NumberField,
  Select,
  Slider,
  Stack,
  Text,
  Toggle,
  ToggleGroup,
} from "@uiid/design-system";
import {
  BombIcon,
  CalendarArrowDownIcon,
  CalendarArrowUpIcon,
  FeatherIcon,
  RefreshCcwIcon,
} from "@uiid/design-system/icons";

import {
  ANY_CUBE_VALUE,
  CRAWFORD_FILTERS,
  cubeValueLadder,
  DIE_FACES,
  filtersFrom,
  KIND_FILTERS,
  SEVERITY_BANDS,
  SEVERITY_COLOR,
  SORTS,
  sortFrom,
  STANDING_FILTERS,
  type BlunderSort,
  type CubeValueRange,
  type DiceFilter,
  tabFrom,
  viewParams,
  SIDEBAR_MAXWIDTH,
} from "@/lib/constants";
import type { FilterCounts } from "@/server/router";
import { useTRPC } from "@/trpc/client";

interface BlunderFilterPanelProps {
  category: string;
  /** The highest face in the data, which is where the Cube value track stops. */
  topCubeValue: number;
  /** The longest match in the data, which is what caps the Min. score field. */
  longestMatch: number;
}

/** One row of a dropdown: Select keys it by `value`, the constants by `id`. */
interface FilterItem {
  value: string;
  label: string;
  children: React.ReactNode;
}

interface OptionCountProps {
  /** Undefined until the counts land, or if the query for them failed. */
  count: number | undefined;
}

/**
 * How many rows the option beside it would leave, counted under everything
 * ticked outside its own dropdown — so a 0 is an option that leads nowhere, and
 * reads as one before it is picked rather than after.
 *
 * Nothing is drawn until the count arrives, so a row that has none is the row it
 * was before rather than a badge standing empty.
 */
function OptionCount({ count }: OptionCountProps) {
  if (count === undefined) return null;

  return <Badge color="neutral">{count}</Badge>;
}

/**
 * The three kinds, each with what picking it would leave. The name is drawn
 * through `children` rather than left to `label` so the count has somewhere to
 * sit beside it; `label` stays what the closed trigger reads back and what
 * typeahead matches, as it does in the two groups below.
 */
const kindItems = (counts: FilterCounts | undefined): FilterItem[] =>
  KIND_FILTERS.map(({ id, label }) => ({
    value: id,
    label,
    children: (
      <>
        <Text size={0}>{label}</Text>
        <OptionCount count={counts?.kinds[id]} />
      </>
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
 * The range sits with the band name rather than across the row from it: it says
 * which errors the band covers, which is part of naming the band. That leaves
 * the count alone on the right, where Kind's and Crawford's counts already are,
 * so one column of numbers runs down every popup in the panel.
 *
 * `children` draws the row in place of the label, which stays a plain string
 * because it is also what the closed trigger reads back: the popup shows
 * "Catastrophic 0.400+ 13" in red, the trigger still shows "Catastrophic".
 */
const severityItems = (counts: FilterCounts | undefined): FilterItem[] =>
  SEVERITY_BANDS.map(({ id, label, min }, index) => {
    const above = SEVERITY_BANDS[index - 1]?.min;
    const range =
      above === undefined
        ? `${min.toFixed(3)}+`
        : `${min.toFixed(3)}–${(above - 0.001).toFixed(3)}`;

    return {
      value: id,
      label,
      children: (
        <>
          <Group gap={2} ay="center">
            <Text size={0}>{label}</Text>
            <Badge color={SEVERITY_COLOR[id]}>{range}</Badge>
          </Group>
          <OptionCount count={counts?.severities[id]} />
        </>
      ),
    };
  });

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
const crawfordItems = (counts: FilterCounts | undefined): FilterItem[] =>
  CRAWFORD_FILTERS.map(({ id, label, description }) => ({
    value: id,
    label,
    children: (
      <>
        <Stack gap={0}>
          <Text size={0}>{label}</Text>
          <Text size={-1} shade="halftone">
            {description}
          </Text>
        </Stack>
        <OptionCount count={counts?.crawfords[id]} />
      </>
    ),
  }));

/**
 * Where the match stood, each with what picking it would leave. Plain names and
 * a count, the way Kind's are: these three need no line under them saying what
 * they mean, and `STANDING_FILTERS` carries none to draw.
 */
const standingItems = (counts: FilterCounts | undefined): FilterItem[] =>
  STANDING_FILTERS.map(({ id, label }) => ({
    value: id,
    label,
    children: (
      <>
        <Text size={0}>{label}</Text>
        <OptionCount count={counts?.standings[id]} />
      </>
    ),
  }));

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
  // Only the first letter comes down, rather than the whole name: "Cube value"
  // still reads "Reset cube value", but a label carrying a symbol keeps it, and
  // "Min. score (Δ)" no longer asks to be reset as a lower-case delta.
  const reset = `Reset ${filter.charAt(0).toLowerCase()}${filter.slice(1)}`;

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
  items: FilterItem[];
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

/** Stands for no face picked, which a list row needs a value of its own for. */
const ANY_DIE = "any";

interface DieSelectProps {
  /**
   * Named for a reader using a screen reader rather than on the panel, which
   * carries one "Roll" above the pair instead of a heading over each list.
   */
  label: string;
  /** The face this list holds, or undefined while it sits on Any. */
  face: number | undefined;
  onPick: (face: number | null) => void;
}

/**
 * One face of the roll, as a list of all six with Any above them. Every face
 * stays pickable whatever the other list holds: the pair is matched either way
 * round, so nothing chosen here can make a face in the other list impossible —
 * which is what the Cube value ends disable each other for.
 *
 * The name rides on the trigger rather than on `Select` itself. Anything the
 * component doesn't claim is spread onto Base UI's `Select.Root`, which renders
 * no element of its own, so an `aria-label` left there reaches no DOM at all and
 * both lists go out unnamed — two comboboxes reading "Any" with nothing to tell
 * them apart, having type-checked, linted and built. `TriggerProps` lands on the
 * button a reader actually focuses. Raised upstream as UI-227.
 */
function DieSelect({ label, face, onPick }: DieSelectProps) {
  return (
    <Select
      TriggerProps={{ "aria-label": label }}
      fullwidth
      size="small"
      value={face === undefined ? ANY_DIE : String(face)}
      onValueChange={(next) => onPick(next === ANY_DIE ? null : Number(next))}
      items={[
        { value: ANY_DIE, label: "Any" },
        ...DIE_FACES.map((pip) => ({ value: String(pip), label: String(pip) })),
      ]}
      PositionerProps={{ alignItemWithTrigger: false }}
    />
  );
}

interface RollFilterProps {
  value: DiceFilter;
  /** Which of the two lists changed, and the face it now holds — null for Any. */
  onPick: (slot: 0 | 1, face: number | null) => void;
  onReset: () => void;
}

/**
 * The roll as its two faces, in two lists under one label — the shape the Cube
 * value filter gives its own two ends — and one reset for the pair rather than
 * one each, because the two lists are one roll.
 *
 * They are slots in a set rather than the `die_1` and `die_2` columns: picking 6
 * then 3 and picking 3 then 6 are the same filter, and both read back higher
 * first, the way the Roll column draws every roll. Leaving one on Any is what
 * asks for every roll containing the other face. See `DiceFilter`.
 */
function RollFilter({ value, onPick, onReset }: RollFilterProps) {
  return (
    <Field
      label="Roll"
      fullwidth
      action={<ResetButton filter="Roll" disabled={value.length === 0} onClick={onReset} />}
    >
      <Group gap={1.5} fullwidth>
        <DieSelect label="Die 1" face={value[0]} onPick={(face) => onPick(0, face)} />
        <DieSelect label="Die 2" face={value[1]} onPick={(face) => onPick(1, face)} />
      </Group>
    </Field>
  );
}

interface MinLeadFieldProps {
  /** The biggest lead the data could hold: one less than its longest match. */
  max: number;
  value: number | null;
  onCommit: (minLead: number | null) => void;
}

/**
 * How far apart the scores had to be, as a number of points typed or stepped.
 * A field rather than a track because the ceiling moves with the data: every
 * match scraped so far is to 3 or 5 points, so the lead runs 1 to 4 today, but
 * matches are commonly played to 19 or 21 — a slider stretched to those would
 * be mostly stops that empty the list, while a field reads the same at either
 * size.
 *
 * It rests at 0, which is no floor: a minimum of 0 asks for every row there is,
 * so the field sitting there and the field never touched are the same question.
 * `?lead=` is left off the URL for it either way, and the reset stays disabled
 * until a real floor is set.
 *
 * It says nothing about which side is ahead — that is what the Advantage ticks
 * beside it are for, and the two read together as one sentence: Losing, by 2 or
 * more.
 */
function MinLeadField({ max, value, onCommit }: MinLeadFieldProps) {
  // Held here rather than read straight off the URL, for the reason the cube
  // track's ends are: every keystroke would otherwise be a `router.push`, and
  // so a server round trip per digit, with the field lagging the typing.
  const [held, setHeld] = useState(value);

  // Anything that moves the floor without touching this field — the reset, the
  // back button, a link — changes the URL under us, so the field follows it.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setHeld(value);
  }

  return (
    <NumberField
      label="Min. score (Δ)"
      action={
        <ResetButton
          filter="Min. score (Δ)"
          disabled={value === null}
          onClick={() => {
            setHeld(null);
            onCommit(null);
          }}
        />
      }
      FieldProps={{ fullwidth: true }}
      size="small"
      min={0}
      max={max}
      value={held ?? 0}
      onValueChange={(next) => setHeld(next)}
      // The URL is written when the value settles — on blur after typing, on
      // release after a stepper — and not on the way there. Committing is also
      // where the value has been clamped into `min`..`max`, so a 9 typed into a
      // field that stops at 4 asks for the 4 it visibly became.
      onValueCommitted={(next) => onCommit(next !== null && next >= 1 ? next : null)}
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
 * at once, and a list over each end to name it exactly. All three read and
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
      <Group gap={1.5}>
        <FaceSelect
          label="Min."
          ladder={ladder}
          position={low}
          allows={(stop) => stop <= high}
          onPick={(stop) => commit(stop, high)}
        />
        <FaceSelect
          label="Max."
          ladder={ladder}
          position={high}
          allows={(stop) => stop >= low}
          onPick={(stop) => commit(low, stop)}
        />
      </Group>
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
    </Group>
  );
}

/**
 * What each ordering puts at the top. The first pair names the blunder the sort
 * leads with — a bomb against a feather, the two ends of the same scale the
 * severity colours run along — and the second pair names the direction the date
 * runs, down for newest first the way a descending sort is drawn everywhere
 * else.
 *
 * Kept here beside the toggles rather than next to the labels in the constants,
 * which the server imports and which has no business holding components.
 */
const SORT_ICONS: Record<BlunderSort, typeof BombIcon> = {
  worst: BombIcon,
  mildest: FeatherIcon,
  newest: CalendarArrowDownIcon,
  oldest: CalendarArrowUpIcon,
};

/**
 * A sidebar of fixed width, so ticking never changes the table's width; a long
 * list of picks truncates instead. Nothing ticked in a dropdown means nothing
 * is filtered out, so the empty state says "All" rather than looking unset.
 * Every change goes through `viewParams`, which writes no `?page=`, so the list
 * starts again at page 1.
 */
export function BlunderFilterPanel({
  category,
  topCubeValue,
  longestMatch,
}: BlunderFilterPanelProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = filtersFrom(searchParams);
  const sort = sortFrom(searchParams.get("sort"));

  // The sidebar narrows whichever half is showing and never moves between them,
  // so every URL it writes carries the tab back out again.
  const tab = tabFrom(searchParams.get("tab"));

  // Every option's count, in one query for the whole panel. Asked for from the
  // browser rather than prefetched with the page: the dropdowns are shut when a
  // page lands, so the badges are there well before anything opens on them.
  //
  // Held from a tick ago while the next ones land, so the numbers change in
  // place rather than emptying out and refilling under an open popup.
  const { data: counts } = useQuery({
    ...trpc.blunders.filterCounts.queryOptions({ category, ...filters }),
    placeholderData: keepPreviousData,
  });

  // The track covers the data, and also whatever a hand-written URL asks about,
  // so a face nobody has reached yet still parks its end where it says it is
  // rather than somewhere the reader has to guess at.
  const ladder = cubeValueLadder(
    Math.max(topCubeValue, filters.cubeValue.min ?? 1, filters.cubeValue.max ?? 1),
  );

  // A match to n points can be led by n - 1 of them. The field reaches whatever
  // a hand-written URL already asks for as well, so a floor typed past the data
  // reads back as the number it is set to rather than being clamped to one the
  // reader never asked for. At least 1, so the ceiling is never under the floor.
  const maxLead = Math.max(longestMatch - 1, filters.minLead ?? 1, 1);

  function show(params: URLSearchParams) {
    const query = params.toString();
    router.push(query ? `/${category}?${query}` : `/${category}`);
  }

  // Select hands back the values in the order they were ticked, so they go
  // through `filtersFrom` to come out in the constants' order, like the server's.
  function pick(param: "kind" | "severity" | "crawford" | "standing", values: string[]) {
    const params = new URLSearchParams(searchParams);
    params.delete(param);
    for (const value of values) params.append(param, value);
    show(viewParams(filtersFrom(params), sort, tab));
  }

  // The two lists are slots in one roll rather than filters of their own, so a
  // pick rewrites the pair and `filtersFrom` sorts it back higher first — the
  // round trip the ticked groups above take through `pick`.
  function pickDie(slot: 0 | 1, face: number | null) {
    const faces = [filters.dice[0], filters.dice[1]];
    faces[slot] = face ?? undefined;

    const params = new URLSearchParams(searchParams);
    params.delete("die");
    for (const die of faces) {
      if (die !== undefined) params.append("die", String(die));
    }
    show(viewParams(filtersFrom(params), sort, tab));
  }

  return (
    <Stack w={SIDEBAR_MAXWIDTH} gap={6} ax="stretch">
      {/* A sort is always set, so pressing the pressed one again changes nothing. */}
      <ToggleGroup
        aria-label="Sort"
        fullwidth
        value={[sort]}
        onValueChange={([next]) => next && show(viewParams(filters, sortFrom(next), tab))}
        size="small"
      >
        {/* Grouped and wrapped the way the view toggle's icons are: a `Toggle`
            holds no gap of its own where `Button` does, it collapses to a
            square on `:has(svg:only-child)` — which a bare text node does not
            break — and it sizes an icon's height without the `width: auto`
            that would keep the glyph square. */}
        {SORTS.map(({ id, label }) => {
          const Icon = SORT_ICONS[id];

          return (
            <Toggle key={id} value={id}>
              <Group ay="center" gap={2}>
                {/* Drawn at the size the view toggle draws its own pair at,
                    rather than the larger one this group's `small` would hand
                    it: that is the size the sidebar's own reset already uses,
                    so these join what is around them instead of setting a
                    third size. Pointed at the token that toggle resolves
                    through rather than the 12px it currently comes out as, so
                    the two keep matching if the design system retunes it. */}
                <Icon style={{ width: "auto", height: "var(--forms-size-xs-icon-size)" }} />
                <span>{label}</span>
              </Group>
            </Toggle>
          );
        })}
      </ToggleGroup>

      <FilterSelect
        label="Kind"
        placeholder="All kinds"
        items={kindItems(counts)}
        value={filters.kinds}
        onValueChange={(values) => pick("kind", values)}
      />
      <FilterSelect
        label="Severity"
        placeholder="All severities"
        items={severityItems(counts)}
        value={filters.severities}
        onValueChange={(values) => pick("severity", values)}
      />
      <FilterSelect
        label="Crawford"
        placeholder="All games"
        items={crawfordItems(counts)}
        value={filters.crawfords}
        onValueChange={(values) => pick("crawford", values)}
      />

      <Group gap={2} evenly fullwidth>
        <FilterSelect
          label="Advantage"
          placeholder="All scores"
          items={standingItems(counts)}
          value={filters.standings}
          onValueChange={(values) => pick("standing", values)}
        />
        <MinLeadField
          max={maxLead}
          value={filters.minLead}
          onCommit={(minLead) => show(viewParams({ ...filters, minLead }, sort, tab))}
        />
      </Group>
      <RollFilter
        value={filters.dice}
        onPick={pickDie}
        onReset={() => show(viewParams({ ...filters, dice: [] }, sort, tab))}
      />
      <CubeValueFilter
        ladder={ladder}
        value={filters.cubeValue}
        onValueChange={(cubeValue) => show(viewParams({ ...filters, cubeValue }, sort, tab))}
      />
    </Stack>
  );
}
