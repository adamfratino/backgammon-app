"use client";

import { useRouter, useSearchParams } from "next/navigation";

import {
  type BlunderSort,
  CUBE_DIRECTIONS,
  viewParams,
  filtersFrom,
  sortFrom,
  KINDS,
  SORTS,
  KIND_LABELS,
  SEVERITY_BANDS,
} from "@/lib/constants";

interface BlunderFilterPanelProps {
  category: string;
}

export function BlunderFilterPanel({ category }: BlunderFilterPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = filtersFrom(searchParams);
  const sort = sortFrom(searchParams.get("sort"));

  function show(params: URLSearchParams) {
    const query = params.toString();
    router.push(query ? `/${category}?${query}` : `/${category}`);
  }

  function toggle(param: string, value: string, checked: boolean) {
    const params = new URLSearchParams(searchParams);
    if (checked) params.append(param, value);
    else params.delete(param, value);

    show(viewParams(filtersFrom(params), sortFrom(params.get("sort"))));
  }

  function choose(next: BlunderSort) {
    show(viewParams(filters, next));
  }

  return (
    <div style={{ display: "flex", gap: "2rem" }}>
      <FilterGroup
        legend="Kind"
        param="kind"
        options={KINDS.map((id) => ({ id, label: KIND_LABELS[id] }))}
        chosen={filters.kinds}
        onToggle={toggle}
      />
      <FilterGroup
        legend="Severity"
        param="severity"
        options={SEVERITY_BANDS}
        chosen={filters.severities}
        onToggle={toggle}
      />
      <FilterGroup
        legend="Cube"
        param="direction"
        options={CUBE_DIRECTIONS}
        chosen={filters.directions}
        onToggle={toggle}
      />
      <SortGroup sort={sort} onChoose={choose} />
    </div>
  );
}

interface FilterGroupProps {
  legend: string;
  param: string;
  options: readonly { id: string; label: string }[];
  chosen: readonly string[];
  onToggle: (param: string, value: string, checked: boolean) => void;
}

/** One group of checkboxes. The `name` is the query param it writes. */
function FilterGroup({ legend, param, options, chosen, onToggle }: FilterGroupProps) {
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
      <legend>{legend}</legend>
      {options.map(({ id, label }) => (
        <label key={id} style={{ display: "block" }}>
          <input
            type="checkbox"
            name={param}
            value={id}
            checked={chosen.includes(id)}
            onChange={(event) => onToggle(param, id, event.currentTarget.checked)}
          />{" "}
          {label}
        </label>
      ))}
    </fieldset>
  );
}

interface SortGroupProps {
  sort: BlunderSort;
  onChoose: (sort: BlunderSort) => void;
}

/**
 * Radios, not checkboxes, because a sort is one choice rather than a set — and
 * because one of them is always on, there is no "nothing selected" state to
 * represent. That is the whole difference between `sortFrom` and `filtersFrom`,
 * made visible in the markup.
 */
function SortGroup({ sort, onChoose }: SortGroupProps) {
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
      <legend>Sort</legend>
      {SORTS.map(({ id, label }) => (
        <label key={id} style={{ display: "block" }}>
          <input
            type="radio"
            name="sort"
            value={id}
            checked={sort === id}
            onChange={() => onChoose(id)}
          />{" "}
          {label}
        </label>
      ))}
    </fieldset>
  );
}
