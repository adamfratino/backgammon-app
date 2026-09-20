"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Badge, List, ListItem, Text } from "@uiid/design-system";

import { categoryLabel, filtersFrom, isFiltered } from "@/lib/constants";
import type { Category } from "@/server/router";
import { useTRPC } from "@/trpc/client";

import { CategoryLink } from "./category-link";

/** How far back a category the filters have emptied falls. */
const EMPTY_OPACITY = 0.5;

interface CategoriesProps {
  categories: Category[];
}

/**
 * The categories, each badged with how many of its blunders the filters leave.
 *
 * Every category counts, not just the one you are in: the filters ride along
 * when you switch, so a badge is what that category would show if you went
 * there — which is what makes it worth reading before you do.
 *
 * The sidebar sits in the root layout, which no navigation re-renders, so the
 * counting happens here rather than on the server. `/` is prerendered before any
 * URL exists, so it starts as the totals the server rendered and goes live once
 * the browser has a URL to read filters from.
 */
export function CategoryCounts({ categories }: CategoriesProps) {
  return (
    <Suspense fallback={<CategoryItems categories={categories} />}>
      <LiveCategoryItems categories={categories} />
    </Suspense>
  );
}

function LiveCategoryItems({ categories }: CategoriesProps) {
  const trpc = useTRPC();
  const searchParams = useSearchParams();
  const filters = filtersFrom(searchParams);
  const filtered = isFiltered(filters);

  const { data } = useQuery({
    ...trpc.categories.list.queryOptions(filters),
    // Nothing narrowed is the list the server already rendered, so at rest the
    // sidebar asks for nothing at all.
    enabled: filtered,
    // Hold the counts from a filter ago while the next ones land, rather than
    // dropping back to the totals and counting down again on every tick.
    placeholderData: keepPreviousData,
  });

  // `placeholderData` outlives `enabled`, so clearing the filters leaves the
  // counts they produced sitting in `data`. Reading it only while something is
  // narrowing is what stops those stale counts from being shown as live ones.
  const counts = filtered ? data : undefined;

  // Until they arrive there is no count to show, only the total the server
  // rendered — which is exactly what one number on a badge means.
  return <CategoryItems categories={counts ?? categories} counted={counts !== undefined} />;
}

interface CategoryItemsProps extends CategoriesProps {
  /** Whether `count` is a live count under filters, rather than the bare total. */
  counted?: boolean;
}

/**
 * Nothing narrowing means one number, since the count would only repeat the
 * total. Once something is, every badge reads `count of total` — including a
 * category the filters happen to leave whole, which otherwise could not be told
 * apart from one nothing was asked of.
 */
function CategoryItems({ categories, counted = false }: CategoryItemsProps) {
  return (
    <List>
      {categories.map(({ category, count, total }) => (
        <ListItem
          key={category}
          // A category with nothing left in it fades back, so the eye lands on
          // the ones that still have something. It stays a link: it leads to the
          // page that says the filters, not the category, emptied it.
          style={{ opacity: counted && count === 0 ? EMPTY_OPACITY : 1 }}
        >
          <CategoryLink category={category}>
            <Text>{categoryLabel(category)}</Text>
            <Badge size="small" color="neutral">
              {counted ? (
                <>
                  <data value={count}>{count}</data> of {total}
                </>
              ) : (
                <data value={total}>{total}</data>
              )}
            </Badge>
          </CategoryLink>
        </ListItem>
      ))}
    </List>
  );
}
