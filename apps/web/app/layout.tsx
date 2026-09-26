import { Group, Stack, Toaster, ToastProvider } from "@uiid/design-system";
import { chartTheme } from "@/lib/chart-theme";
import { TRPCReactProvider } from "@/trpc/client";
import { Sidebar } from "@/components/sidebar";
import { SyncToasts } from "@/components/sync-toasts";
import { Topbar } from "@/components/topbar";

import "@uiid/design-system/globals.css";
import "@microcharts/react/styles.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <Group
        data-slot="root-layout"
        render={<body />}
        m={0}
        fullscreen
        style={{ ...chartTheme.style, overflow: "hidden" }}
      >
        <TRPCReactProvider>
          <ToastProvider>
            <Stack gap={6} p={6} pr={3} br={1} ay="stretch">
              <Sidebar />
            </Stack>
            <Stack ax="stretch" minw={0} fullscreen>
              <Topbar />
              <Stack render={<main />} ax="stretch" style={{ flex: 1, overflowY: "auto" }}>
                {children}
              </Stack>
            </Stack>
            <SyncToasts />
            <Toaster position="bottom" />
          </ToastProvider>
        </TRPCReactProvider>
      </Group>
    </html>
  );
}
