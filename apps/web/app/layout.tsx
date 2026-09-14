import { Group, Stack } from "@uiid/design-system";
import { TRPCReactProvider } from "@/trpc/client";
import { CategoryNav } from "./category-nav";

import "@uiid/design-system/globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <Group render={<body />} m={0}>
        <TRPCReactProvider>
          <Stack gap={6} p={6} br={1}>
            <CategoryNav />
          </Stack>
          {children}
        </TRPCReactProvider>
      </Group>
    </html>
  );
}
