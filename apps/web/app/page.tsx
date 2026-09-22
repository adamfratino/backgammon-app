import { Group, Stack, Text } from "@uiid/design-system";

import { MAIN_MAXWIDTH, SPACING_LG, SPACING_SM } from "@/lib/constants";

import { ErTrend } from "@/components/er-trend";
import { FormTrend } from "@/components/form-trend";
import { Leaks } from "@/components/leaks";
import { RecentMatches } from "@/components/recent-matches";

export default function Home() {
  return (
    <Stack
      data-slot="root-page"
      ax="stretch"
      minw={0}
      p={SPACING_LG}
      gap={SPACING_LG}
      maxw={MAIN_MAXWIDTH}
    >
      <Group evenly gap={SPACING_LG} ay="start">
        <Stack gap={SPACING_LG} ax="stretch">
          <RecentMatches />
          <Leaks />
        </Stack>
        <Stack gap={SPACING_LG} ax="stretch">
          <ErTrend />
          <FormTrend />
        </Stack>
      </Group>
    </Stack>
  );
}
