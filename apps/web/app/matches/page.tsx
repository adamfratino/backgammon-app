import { Group, Stack, Text } from "@uiid/design-system";

import { MatchFilterPanel } from "@/components/match-filters";
import { MatchList } from "@/components/match-list";
import { ViewPagination } from "@/components/view-pagination";
import {
  DEFAULT_TAB,
  filtersFrom,
  isFiltered,
  matchSortFrom,
  pageFrom,
  PER_PAGE,
  SPACING_LG,
  viewParams,
} from "@/lib/constants";
import { caller } from "@/server/caller";

interface MatchesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const sidebarStyles: React.CSSProperties = { position: "sticky", top: 0 };

/**
 * Every match, a page at a time, drawn the way the homepage's last few are and
 * narrowed by a category's filters. Built on the server from the URL alone: the
 * panel and the pager write the URL, and this reads it back.
 */
export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const query = await searchParams;
  const search = new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) => [value ?? []].flat().map((one) => [key, one])),
  );

  const page = pageFrom(search.get("page"));
  const filters = filtersFrom(search);
  const sort = matchSortFrom(search.get("sort"));

  const [{ matches, total }, topCubeValue, longestMatch] = await Promise.all([
    caller.matches.list({ page, ...filters, sort }),
    caller.blunders.topCubeValue(),
    caller.blunders.longestMatch(),
  ]);

  const first = (page - 1) * PER_PAGE + 1;
  const last = first + matches.length - 1;

  return (
    <Group data-slot="matches-page" ay="start" fullwidth>
      <Stack ax="stretch" minw={0} p={SPACING_LG} gap={SPACING_LG} style={{ flex: 1 }}>
        <Text render={<h1 />} size={3} weight="bold">
          Matches
        </Text>
        {total === 0 ? (
          <p>
            {isFiltered(filters) ? "No match has a blunder these filters keep." : "No matches yet."}
          </p>
        ) : (
          <>
            <MatchList matches={matches} />
            <Group gap={2} fullwidth ax="space-between">
              <ViewPagination
                page={page}
                total={total}
                view={viewParams(filters, sort, DEFAULT_TAB).toString()}
              />
              <Text shade="muted">
                Showing {first}–{last} of <data value={total}>{total}</data> matches
              </Text>
            </Group>
          </>
        )}
      </Stack>
      <Stack gap={SPACING_LG} bl={1} bb={1} p={SPACING_LG} style={sidebarStyles}>
        <MatchFilterPanel topCubeValue={topCubeValue} longestMatch={longestMatch} />
      </Stack>
    </Group>
  );
}
