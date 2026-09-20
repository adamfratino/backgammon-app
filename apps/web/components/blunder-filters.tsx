"use client";

import { useId } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Badge,
  Button,
  Group,
  Select,
  Stack,
  Text,
  Toggle,
  ToggleGroup,
} from "@uiid/design-system";
import { RefreshCcwIcon } from "@uiid/design-system/icons";

import {
  CRAWFORD_FILTERS,
  filtersFrom,
  KIND_FILTERS,
  SEVERITY_BANDS,
  SEVERITY_COLOR,
  SORTS,
  sortFrom,
  viewParams,
  SIDEBAR_MAXWIDTH,
} from "@/lib/constants";

interface BlunderFilterPanelProps {
  category: string;
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

interface FilterSelectProps {
  label: string;
  placeholder: string;
  items: { value: string; label: string; children?: React.ReactNode }[];
  value: string[];
  onValueChange: (values: string[]) => void;
}

/**
 * A dropdown under its own label row, which carries a reset for just this
 * dropdown. The row sits outside the Select because the DS Field's label row
 * only takes a hint icon, not a button; once UI-216 gives it an `action` slot,
 * this goes back to Select's `label` with the reset as its action. The popup
 * opens below the trigger rather than over it, leaving the picks in view, where
 * nothing clips the options.
 */
function FilterSelect({ label, value, onValueChange, ...props }: FilterSelectProps) {
  const labelId = useId();
  const reset = `Reset ${label.toLowerCase()}`;

  return (
    <Stack gap={1} ax="stretch">
      <Group ax="space-between" ay="center">
        <Text id={labelId} size={-1} weight="bold">
          {label}
        </Text>
        <Button
          variant="ghost"
          size="xsmall"
          shape="square"
          tooltip={reset}
          aria-label={reset}
          disabled={value.length === 0}
          onClick={() => onValueChange([])}
        >
          <RefreshCcwIcon />
        </Button>
      </Group>
      <Select
        {...props}
        multiple
        fullwidth
        value={value}
        onValueChange={onValueChange}
        size="small"
        TriggerProps={{ "aria-labelledby": labelId }}
        PositionerProps={{ alignItemWithTrigger: false }}
      />
    </Stack>
  );
}

/**
 * A sidebar of fixed width, so ticking never changes the table's width; a long
 * list of picks truncates instead. Nothing ticked in a dropdown means nothing
 * is filtered out, so the empty state says "All" rather than looking unset.
 * Every change goes through `viewParams`, which writes no `?page=`, so the list
 * starts again at page 1.
 */
export function BlunderFilterPanel({ category }: BlunderFilterPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = filtersFrom(searchParams);
  const sort = sortFrom(searchParams.get("sort"));

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
    <Stack w={SIDEBAR_MAXWIDTH} gap={6} ax="stretch">
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
    </Stack>
  );
}
