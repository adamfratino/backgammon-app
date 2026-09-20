"use client";

import { useState } from "react";
import { Button, Dialog, Group, Text } from "@uiid/design-system";
import { ChevronLeftIcon, ChevronRightIcon, EyeIcon, XIcon } from "@uiid/design-system/icons";

import { parseXgid, pipCount } from "@repo/core";

import type { Blunder } from "@/server/router";

import { BoardArea } from "./board-area";

interface BlunderQuickViewProps {
  /** The row this button belongs to, and where a visit starts and returns to. */
  blunder: Blunder;
  /** The page of rows to step through, in the order the table drew them. */
  rows: Blunder[];
  /** Where `blunder` sits in `rows`. */
  startIndex: number;
  /** The pip-count setting as the server read it when the page rendered. */
  showPipCounts: boolean;
  /** Which way round the board faces, read from its own cookie the same way. */
  flipBoard: boolean;
}

/**
 * The position without leaving the list. Every row already carries its own XGID
 * for the Copy button, so the board behind this asks the server for nothing the
 * table has not already fetched — and stepping between rows costs no request at
 * all, since the neighbours are the same rows the table has in hand.
 */
export function BlunderQuickView({
  blunder,
  rows,
  startIndex,
  showPipCounts,
  flipBoard,
}: BlunderQuickViewProps) {
  // Held here rather than left to the dialog, so the close button in the header
  // has something to close: the dialog ships no Close of its own.
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(startIndex);

  // The table hands down a fresh `rows` whenever it refetches, so the index may
  // briefly point past the end. The row this button belongs to is always a row.
  const current = rows[index] ?? blunder;

  // Every way out runs through here — the button below, Escape, the backdrop —
  // so each visit starts at the row that was clicked rather than wherever the
  // last one wandered off to.
  function close() {
    setOpen(false);
    setIndex(startIndex);
  }

  return (
    <Dialog
      size="large"
      title={`Blunder #${current.blunder_id}`}
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
      action={
        <Button
          size="small"
          variant="subtle"
          shape="square"
          onClick={close}
          tooltip="Close"
          aria-label="Close quick view"
        >
          <XIcon />
        </Button>
      }
      trigger={
        <Button
          size="small"
          shape="square"
          variant="subtle"
          tooltip="Quick view"
          aria-label="Quick view"
        >
          <EyeIcon />
        </Button>
      }
      footer={
        // Walks the page the reader is already looking at, in the order the
        // table drew it, and stops at its edges. Reaching past them is what
        // paging the table is for; the stepper on a blunder's own page is the
        // one that crosses, because it has the URL to carry the new page in.
        <Group
          render={<nav />}
          aria-label="Step through blunders"
          fullwidth
          ax="space-between"
          ay="center"
        >
          <Button
            size="xsmall"
            variant="subtle"
            shape="square"
            disabled={index <= 0}
            onClick={() => setIndex(index - 1)}
            tooltip="Previous blunder"
            aria-label="Previous blunder"
          >
            <ChevronLeftIcon />
          </Button>
          <Text size={-1} shade="muted">
            {index + 1} of {rows.length} on this page
          </Text>
          <Button
            size="xsmall"
            variant="subtle"
            shape="square"
            disabled={index >= rows.length - 1}
            onClick={() => setIndex(index + 1)}
            tooltip="Next blunder"
            aria-label="Next blunder"
          >
            <ChevronRightIcon />
          </Button>
        </Group>
      }
    >
      <QuickViewBoard blunder={current} showPipCounts={showPipCounts} flipBoard={flipBoard} />
    </Dialog>
  );
}

/**
 * Parsed here rather than on the server, as the blunder page does it. A closed
 * dialog renders nothing, so a page of rows costs one parse on the click and
 * none before it — and `@repo/core` is already in the browser bundle, since the
 * board itself reads from it, so the parser rides along for about a kilobyte.
 */
function QuickViewBoard({
  blunder,
  showPipCounts,
  flipBoard,
}: Pick<BlunderQuickViewProps, "blunder" | "showPipCounts" | "flipBoard">) {
  const { blunder_id, cube_action, source_xgid } = blunder;

  const parsed = source_xgid ? parseXgid(source_xgid) : null;
  const pipCounts = parsed
    ? { player: pipCount(parsed.position.player), opponent: pipCount(parsed.position.opponent) }
    : null;

  // No store of its own, unlike the blunder page. There the server re-reads the
  // cookies on every navigation, so a fresh store per blunder starts from what
  // the reader last chose. Here the settings were read once, when the page
  // rendered, so a fresh store per open would undo a switch thrown in the
  // previous row's board. The shared one leaves both where the reader put them.
  return (
    <BoardArea
      source_xgid={source_xgid}
      blunder_id={blunder_id}
      cube_action={cube_action}
      parsed={parsed}
      pipCounts={pipCounts}
      showPipCounts={showPipCounts}
      flipBoard={flipBoard}
    />
  );
}
