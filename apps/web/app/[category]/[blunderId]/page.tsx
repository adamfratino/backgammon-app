import { notFound } from "next/navigation";

import { caller } from "@/server/caller";
import { BlunderAnalysis } from "../analysis";

interface BlunderPageProps {
  params: Promise<{ category: string; blunderId: string }>;
}

export default async function BlunderPage({ params }: BlunderPageProps) {
  const { category, blunderId } = await params;

  // `blunderId` is whatever was in the URL bar, so it is a string that may not
  // be a number at all. `Number("12abc")` is NaN and `Number("")` is 0.
  const blunder_id = Number(blunderId);
  if (!Number.isInteger(blunder_id)) notFound();

  const detail = await caller.blunders.detail({ category, blunder_id });
  if (!detail) notFound();

  return <BlunderAnalysis detail={detail} />;
}
