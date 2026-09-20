import { Stack, Text } from "@uiid/design-system";

import { FormTrend } from "@/components/form-trend";
import { LeaksTable } from "@/components/leaks-table";

/**
 * Every match at once — the view with no category, which is why its heading sits
 * exactly where a category's name does.
 *
 * Two questions, in the order you'd ask them after playing: am I getting better,
 * and where is it going. Neither can be asked of a single category, which is
 * what this page is for; picking one is the sidebar's job and it is already
 * showing.
 *
 * No filters here. The sidebar narrows a category and there is none to narrow,
 * so both panels read the whole record and the page prerenders with it.
 */
export default function Home() {
  return (
    <Stack render={<main />} ax="stretch" minw={0} fullscreen style={{ overflowY: "auto" }}>
      <Stack ax="stretch" minw={0} p={6} gap={6}>
        <Text render={<h1 />} size={3} weight="bold">
          Overall
        </Text>
        <FormTrend />
        <LeaksTable />
      </Stack>
    </Stack>
  );
}
