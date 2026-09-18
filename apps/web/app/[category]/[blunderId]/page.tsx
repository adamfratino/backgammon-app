import { notFound } from "next/navigation";
import { Stack } from "@uiid/design-system";

import { caller } from "@/server/caller";
import { BlunderAnalysis } from "../analysis";
import { BlunderStepper } from "../blunder-stepper";

interface BlunderPageProps {
  params: Promise<{ category: string; blunderId: string }>;
}

const GAP = 6;

export default async function BlunderPage({ params }: BlunderPageProps) {
  const { category, blunderId } = await params;

  // `blunderId` is whatever was in the URL bar, so it is a string that may not
  // be a number at all. `Number("12abc")` is NaN and `Number("")` is 0.
  const blunder_id = Number(blunderId);
  if (!Number.isInteger(blunder_id)) notFound();

  const detail = await caller.blunders.detail({ category, blunder_id });
  if (!detail) notFound();

  return (
    <Stack ax="stretch" fullwidth maxw={960} p={GAP} gap={GAP}>
      <BlunderStepper category={category} blunderId={blunderId} />
      <BlunderAnalysis detail={detail} />
    </Stack>
  );
}
