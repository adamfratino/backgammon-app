import { Group, Stack, Text } from "@uiid/design-system";

import { FormTrend } from "@/components/form-trend";
import { Leaks } from "@/components/leaks";
import { RecentMatches } from "@/components/recent-matches";

/**
 * Every match at once — the view with no category, which is why its heading sits
 * exactly where a category's name does.
 *
 * Two questions, in the order you'd ask them after playing: am I getting better,
 * and where is it going. Neither can be asked of a single category, which is
 * what this page is for; picking one is the sidebar's job and it is already
 * showing. Beside them sit the matches you just played, which are the latest
 * place it went.
 *
 * No filters here. The sidebar narrows a category and there is none to narrow,
 * so every panel reads the record as it stands and the page prerenders with it.
 */
export default function Home() {
  return (
    <Stack render={<main />} ax="stretch" minw={0} fullscreen style={{ overflowY: "auto" }}>
      <Stack ax="stretch" minw={0} p={6} gap={6} maxw={1260}>
        <Text render={<h1 />} size={3} weight="bold">
          Overview
        </Text>
        <Group evenly gap={4} ay="start">
          <RecentMatches />
          <Stack gap={6} ax="stretch">
            <FormTrend />
            <Leaks />
          </Stack>
        </Group>
      </Stack>
    </Stack>
  );
}
