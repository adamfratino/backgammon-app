"use client";

import { useEffect, useState } from "react";
import { Button, type ButtonProps } from "@uiid/design-system";
import { CheckIcon, CopyIcon, CopyXIcon } from "@uiid/design-system/icons";

type Status = "idle" | "copied" | "error";

/** What each outcome draws, and what the button calls itself while it is showing. */
const OUTCOME = {
  idle: { Icon: CopyIcon, said: null },
  copied: { Icon: CheckIcon, said: "Copied" },
  error: { Icon: CopyXIcon, said: "Copy failed" },
} as const;

interface CopyButtonProps extends Pick<ButtonProps, "size" | "variant"> {
  /** The text placed on the clipboard. */
  value: string;
  /** Names the button for screen readers, which never see the adjacent text. */
  label: string;
  /** Draws `label` beside the icon, for somewhere with the width to spare. */
  showLabel?: boolean;
}

/**
 * Copies `value` and says so. The clipboard API needs a secure context and can
 * be refused outright, so the failure is surfaced rather than swallowed: a
 * button that silently does nothing is worse than one that admits it failed.
 *
 * It answers in the icon rather than in a word beside it, which is what lets the
 * same button sit in a table row: a page of them shares one column, so the reply
 * has to land where the button already is instead of widening what holds it.
 */
export function CopyButton({
  value,
  label,
  showLabel = false,
  size = "small",
  variant = "ghost",
}: CopyButtonProps) {
  const [status, setStatus] = useState<Status>("idle");
  // Copying again while the confirmation is still up should restart its timer.
  // Re-setting the same status is not a state change, so the effect keys off
  // the click time as well and a rapid second click can't be swallowed.
  const [clickedAt, setClickedAt] = useState(0);

  useEffect(() => {
    if (status === "idle") return;
    const timer = setTimeout(() => setStatus("idle"), 1500);
    return () => clearTimeout(timer);
  }, [status, clickedAt]);

  async function copy() {
    setClickedAt(Date.now());
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  const { Icon, said } = OUTCOME[status];

  return (
    <Button
      onClick={copy}
      aria-label={said ?? label}
      // A drawn label already names the button, so only the icon-only one needs
      // a tooltip to say what it is — and, after a click, what it just did.
      tooltip={showLabel ? undefined : (said ?? label)}
      size={size}
      variant={variant}
      shape={!showLabel ? "square" : undefined}
    >
      <Icon />
      {showLabel && label}
    </Button>
  );
}
