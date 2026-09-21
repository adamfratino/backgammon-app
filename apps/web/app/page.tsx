import { cookies } from "next/headers";
import { Group, Stack, Text } from "@uiid/design-system";

import { FormTrend } from "@/components/form-trend";
import { Leaks } from "@/components/leaks";
import { RecentMatches } from "@/components/recent-matches";
import {
  FLIP_BOARD_COOKIE,
  flipBoardFrom,
  PIP_COUNTS_COOKIE,
  pipCountsFrom,
} from "@/lib/board-settings";

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
 * so every panel reads the record as it stands.
 *
 * Rendered per visit rather than once at build, because the recent matches open
 * a quick view whose board is drawn the way you last set it, and those settings
 * are cookies. It also keeps the newest matches the newest after a scrape.
 */
export default async function Home() {
  const jar = await cookies();

  return (
    <Stack render={<main />} ax="stretch" minw={0} fullscreen style={{ overflowY: "auto" }}>
      <Stack ax="stretch" minw={0} p={6} gap={6}>
        <Text render={<h1 />} size={3} weight="bold">
          Overall
        </Text>
        <Group evenly gap={4} ay="start">
          <RecentMatches
            showPipCounts={pipCountsFrom(jar.get(PIP_COUNTS_COOKIE)?.value)}
            flipBoard={flipBoardFrom(jar.get(FLIP_BOARD_COOKIE)?.value)}
          />
          <Stack gap={6} ax="stretch">
            <FormTrend />
            <Leaks />
          </Stack>
        </Group>
      </Stack>
    </Stack>
  );
}
