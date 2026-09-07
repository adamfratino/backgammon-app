"use client";

import { useEffect, useState } from "react";

type Status = "idle" | "copied" | "error";

interface CopyButtonProps {
  /** The text placed on the clipboard. */
  value: string;
  /** Names the button for screen readers, which never see the adjacent text. */
  label: string;
}

const button = {
  flexShrink: 0,
  fontSize: "0.85em",
  padding: "2px 8px",
  cursor: "pointer",
} as const;

/**
 * Copies `value` and says so. The clipboard API needs a secure context and can
 * be refused outright, so the failure is surfaced rather than swallowed: a
 * button that silently does nothing is worse than one that admits it failed.
 */
export function CopyButton({ value, label }: CopyButtonProps) {
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
    <>
      <button type="button" onClick={copy} aria-label={label} style={button}>
        Copy
      </button>
      {/* A live region, so the confirmation is announced and not just seen. */}
      <span role="status" style={{ fontSize: "0.85em" }}>
        {status === "copied" ? "Copied" : status === "error" ? "Copy failed" : ""}
      </span>
    </>
  );
}
