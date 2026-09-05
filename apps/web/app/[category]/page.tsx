import { BlunderBrowser } from "./blunder-browser";

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;

  return (
    <main>
      <h1>{category}</h1>
      <div style={{ display: "flex", gap: "3rem" }}>
        <BlunderBrowser category={category} />
      </div>
    </main>
  );
}
