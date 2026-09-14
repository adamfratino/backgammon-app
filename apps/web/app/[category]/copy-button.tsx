"use client";

import { useEffect, useState } from "react";
import { Button } from "@uiid/design-system";
import { CopyIcon } from "@uiid/design-system/icons";

type Status = "idle" | "copied" | "error";

interface CopyButtonProps {
  /** The text placed on the clipboard. */
  value: string;
  /** Names the button for screen readers, which never see the adjacent text. */
  label: string;
}

/**
 * Copies `value` and says so. The clipboard API needs a secure context and can
 * be refused outright, so the failure is surfaced rather than swallowed: a
 * button that silently does nothing is worse than one that admits it failed.
 */
export function CopyButton({ value, label = "Copy" }: CopyButtonProps) {
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

  return (
    <Button onClick={copy} aria-label={label} size="small" variant="ghost">
      <CopyIcon />
      {label}
    </Button>
  );
}
