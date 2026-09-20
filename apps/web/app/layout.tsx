import { Group, Stack } from "@uiid/design-system";
import { chartTheme } from "@/lib/chart-theme";
import { TRPCReactProvider } from "@/trpc/client";
import { CategoryNav } from "@/components/category-nav";

import "@uiid/design-system/globals.css";
import "@microcharts/react/styles.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <Group render={<body />} m={0} fullscreen style={{ ...chartTheme.style, overflow: "hidden" }}>
        <TRPCReactProvider>
          <Stack gap={6} p={6} br={1} ay="stretch">
            <CategoryNav />
          </Stack>
          {children}
        </TRPCReactProvider>
      </Group>
    </html>
  );
}
