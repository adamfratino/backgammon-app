import Link from "next/link";
import { caller } from "@/server/caller";

/**
 * A Server Component. It calls the procedure directly — no fetch, no HTTP —
 * and its output is baked into the HTML before it reaches the browser.
 */
export async function CategoryNav() {
  const categories = await caller.categories.list();

  return (
    <nav aria-label="Blunder categories">
      <ul>
        {categories.map(({ category, count }) => (
          <li key={category}>
            <Link href={`/${category}`}>
              {category} <data value={count}>({count})</data>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
