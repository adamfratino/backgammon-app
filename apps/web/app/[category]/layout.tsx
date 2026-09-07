import { dehydrate, HydrationBoundary, noop } from "@tanstack/react-query";
import { getQueryClient, trpc } from "@/trpc/server";
import { BlunderList } from "./blunder-list";

interface CategoryLayoutProps {
  params: Promise<{ category: string }>;
  children: React.ReactNode;
}

export default async function CategoryLayout({ params, children }: CategoryLayoutProps) {
  const { category } = await params;

  const queryClient = getQueryClient();
  await queryClient.query(trpc.blunders.byCategory.queryOptions({ category })).catch(noop);

  return (
    <main>
      <h1>{category}</h1>
      <div style={{ display: "flex", gap: "3rem" }}>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <BlunderList category={category} />
        </HydrationBoundary>
        {children}
      </div>
    </main>
  );
}
