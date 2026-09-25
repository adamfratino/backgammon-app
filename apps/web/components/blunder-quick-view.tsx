"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Button, Dialog, Group, Text } from "@uiid/design-system";
import { ChevronLeftIcon, ChevronRightIcon, EyeIcon, XIcon } from "@uiid/design-system/icons";

import { parseXgid, pipCount } from "@repo/core";

import { recallFlipBoard, recallPipCounts } from "@/lib/board-settings";
import type { Blunder } from "@/server/router";

import { BoardArea } from "./board-area";

/** All the quick view reads off a row: which blunder, its position, and the cube's side. */
type QuickViewRow = Pick<Blunder, "blunder_id" | "cube_action" | "source_xgid">;

/** Opens the list's one dialog at a row, and takes the button to hand focus back to. */
type OpenQuickView = (index: number, trigger: HTMLElement | null) => void;

const QuickViewContext = createContext<OpenQuickView | null>(null);

interface QuickViewProviderProps {
  /** The page of rows to step through, in the order they were drawn. */
  rows: QuickViewRow[];
  /**
   * The pip-count setting as the server read it when the page rendered. A page
   * built once rather than per visit has no cookie to read, so it leaves this
   * out and the board reads the cookie itself when the dialog opens.
   */
  showPipCounts?: boolean;
  /** Which way round the board faces, read from its own cookie the same way. */
  flipBoard?: boolean;
  /** The list itself, whose rows draw the triggers. */
  children: ReactNode;
}

/**
 * One dialog for a whole page of rows, opened by whichever row was clicked.
 *
 * A dialog per row cost the list a `Dialog.Root` store, a trigger and a portal
 * each — around nine components a row, for a page that can only ever have one
 * of them open. They are identical apart from which row they start on, so the
 * row travels to the dialog instead: the eye buttons are plain buttons that say
 * where to open, and everything else is mounted once here.
 */
export function QuickViewProvider({
  rows,
  showPipCounts,
  flipBoard,
  children,
}: QuickViewProviderProps) {
  // Open is its own state rather than `index === null`, so the row survives the
  // close. Base UI keeps the popup mounted through its exit transition, and
  // forgetting the row on the way out blanked the board under a dialog still on
  // screen. Every visit names its row on the way in, which is the moment nobody
  // is looking.
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  // Closing used to return focus to the eye button because the eye button was
  // the dialog's trigger. Now that the triggers live out in the rows, the one
  // that opened this has to be remembered.
  const returnFocusTo = useRef<HTMLElement | null>(null);

  const openAt = useCallback<OpenQuickView>((row, trigger) => {
    returnFocusTo.current = trigger;
    setIndex(row);
    setOpen(true);
  }, []);

  // The table hands down a fresh `rows` whenever it refetches, so the index may
  // briefly point past the end.
  const current = rows[index];

  return (
    <QuickViewContext value={openAt}>
      {children}
      <Dialog
        size="large"
        title={current ? `Blunder #${current.blunder_id}` : ""}
        open={open}
        onOpenChange={setOpen}
        // This dialog is opened from the rows, so it has no trigger of its own.
        // Left undefined, `resolveTrigger` plants a focusable empty
        // `<span role="button">` in the list for a screen reader to find.
        TriggerProps={{ render: <span hidden /> }}
        PopupProps={{ finalFocus: returnFocusTo }}
        action={
          <Button
            size="small"
            variant="subtle"
            shape="square"
            onClick={() => setOpen(false)}
            tooltip="Close"
            aria-label="Close quick view"
          >
            <XIcon />
          </Button>
        }
        footer={
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
              disabled={index <= 0}
              onClick={() => setIndex(index - 1)}
              tooltip="Previous blunder"
              aria-label="Previous blunder"
            >
              <ChevronLeftIcon />
              Previous
            </Button>
            <Text size={-1} shade="muted">
              {index + 1} of {rows.length} on this page
            </Text>
            <Button
              size="xsmall"
              variant="subtle"
              disabled={index >= rows.length - 1}
              onClick={() => setIndex(index + 1)}
              tooltip="Next blunder"
              aria-label="Next blunder"
            >
              Next
              <ChevronRightIcon />
            </Button>
          </Group>
        }
      >
        {current && (
          <QuickViewBoard blunder={current} showPipCounts={showPipCounts} flipBoard={flipBoard} />
        )}
      </Dialog>
    </QuickViewContext>
  );
}

/**
 * The position without leaving the list. Every row already carries its own XGID
 * for the Copy button, so the board behind this asks the server for nothing the
 * table has not already fetched — and stepping between rows costs no request at
 * all, since the neighbours are the same rows the table has in hand.
 */
export function QuickViewTrigger({ index }: { index: number }) {
  const openAt = useContext(QuickViewContext);

  return (
    <Button
      size="small"
      shape="square"
      variant="subtle"
      tooltip="Quick view"
      aria-label="Quick view"
      onClick={(event) => openAt?.(index, event.currentTarget)}
    >
      <EyeIcon />
    </Button>
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
}: Pick<QuickViewProviderProps, "showPipCounts" | "flipBoard"> & { blunder: QuickViewRow }) {
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
      showPipCounts={showPipCounts ?? recallPipCounts()}
      flipBoard={flipBoard ?? recallFlipBoard()}
    />
  );
}
