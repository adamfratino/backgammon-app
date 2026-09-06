import { CategoryNav } from "./category-nav";
import { TRPCReactProvider } from "@/trpc/client";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ display: "flex", gap: "3rem" }}>
        <TRPCReactProvider>
          {/* Rendered on the server once. Next reuses it across navigations
              between categories, so it is not re-fetched on every click. */}
          <CategoryNav />
          {children}
        </TRPCReactProvider>
      </body>
    </html>
  );
}
