import { headers } from "next/headers";
import { dehydrate, HydrationBoundary, noop } from "@tanstack/react-query";
import { Stack, Group, Text } from "@uiid/design-system";

import { filtersFrom, pageFrom, sortFrom } from "@/lib/constants";
import { getQueryClient, trpc } from "@/trpc/server";

import { BlunderList } from "./blunder-list";
import { BlunderFilterPanel } from "./blunder-filters";
import { BlunderStepper } from "./blunder-stepper";

interface CategoryLayoutProps {
  params: Promise<{ category: string }>;
  children: React.ReactNode;
}

const GAP = 6;

export default async function CategoryLayout({ params, children }: CategoryLayoutProps) {
  const { category } = await params;

  const queryClient = getQueryClient();

  const search = new URLSearchParams((await headers()).get("x-search") ?? "");
  const page = pageFrom(search.get("page"));
  const filters = filtersFrom(search);
  const sort = sortFrom(search.get("sort"));

  await queryClient
    .query(trpc.blunders.byCategory.queryOptions({ category, page, ...filters, sort }))
    .catch(noop);

  return (
    <Stack render={<main />} ax="stretch" style={{ flex: 1 }}>
      <Stack p={GAP} bb={1}>
        <Text render={<h1 />} size={3} weight="bold">
          {category}
        </Text>
      </Stack>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Group fullwidth>
          <BlunderList category={category} />
          <Stack ax="stretch" fullwidth maxw={960} p={GAP} gap={GAP}>
            {/* <BlunderFilterPanel category={category} /> */}
            <BlunderStepper category={category} />
            {children}
          </Stack>
        </Group>
      </HydrationBoundary>
    </Stack>
  );
}
