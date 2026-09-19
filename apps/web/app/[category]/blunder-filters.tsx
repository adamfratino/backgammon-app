"use client";

import { useId } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Group, Select, Stack, Text, Toggle, ToggleGroup } from "@uiid/design-system";
import { RefreshCcwIcon } from "@uiid/design-system/icons";

import {
  filtersFrom,
  KIND_FILTERS,
  SEVERITY_BANDS,
  SORTS,
  sortFrom,
  viewParams,
  SIDEBAR_MAXWIDTH,
} from "@/lib/constants";

interface BlunderFilterPanelProps {
  category: string;
}

// Select lists `{ value, label }`; the constants are `{ id, label }`.
const KIND_ITEMS = KIND_FILTERS.map(({ id, label }) => ({ value: id, label }));
const SEVERITY_ITEMS = SEVERITY_BANDS.map(({ id, label }) => ({ value: id, label }));

interface FilterSelectProps {
  label: string;
  placeholder: string;
  items: { value: string; label: string }[];
  value: string[];
  onValueChange: (values: string[]) => void;
}

/**
 * A dropdown under its own label row, which carries a reset for just this
 * dropdown. The row sits outside the Select because the DS Field's label row
 * only takes a hint icon, not a button; once UI-216 gives it an `action` slot,
 * this goes back to Select's `label` with the reset as its action. The popup
 * opens below the trigger rather than over it, leaving the picks in view.
 * Below, nothing clips the options, and the DS draws each label as a list item
 * inside a `<ul>`, so the list's own bullets have to be switched off until
 * UI-209 is fixed.
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
        ListProps={{ style: { listStyleType: "none" } }}
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
  function pick(param: "kind" | "severity", values: string[]) {
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
    </Stack>
  );
}
