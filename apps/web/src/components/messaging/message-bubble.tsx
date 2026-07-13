"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { formatClockTime } from "./format-time";

export type BubbleMessage = {
  id: string;
  body: string;
  sentAt: string;
};

export function MessageBubble({
  message,
  isOwn,
  justSent = false,
}: {
  message: BubbleMessage;
  isOwn: boolean;
  // True only for the message the current user just sent via the composer —
  // gives it a small entrance transition. Seeded/history messages render
  // immediately, no orchestrated entrance.
  justSent?: boolean;
}) {
  const [visible, setVisible] = useState(!justSent);

  useEffect(() => {
    if (!justSent) return;
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [justSent]);

  return (
    <div className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-base transition-all duration-200 ease-out sm:max-w-[65%]",
          isOwn
            ? "rounded-br-sm bg-primary text-primary-ink"
            : "rounded-bl-sm border border-border bg-surface text-ink",
          justSent && !visible && "translate-y-1 opacity-0",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <span
          className={cn(
            "mt-1 block text-xs",
            isOwn ? "text-primary-ink/70" : "text-muted",
          )}
        >
          {formatClockTime(message.sentAt)}
        </span>
      </div>
    </div>
  );
}
