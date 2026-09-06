import { dehydrate, HydrationBoundary, noop } from "@tanstack/react-query";
import { getQueryClient, trpc } from "@/trpc/server";
import { BlunderBrowser } from "./blunder-browser";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;

  const queryClient = getQueryClient();
  await queryClient.query(trpc.blunders.byCategory.queryOptions({ category })).catch(noop);

  return (
    <main>
      <h1>{category}</h1>
      <div style={{ display: "flex", gap: "3rem" }}>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <BlunderBrowser key={category} category={category} />
        </HydrationBoundary>
      </div>
    </main>
  );
}
