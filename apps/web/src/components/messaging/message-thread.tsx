"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { TypeBadge } from "@/components/ui/badge";
import {
  CURRENT_USER_SENTINEL,
  type Conversation,
  type MockMessage,
} from "@/lib/mock/conversations";
import { MessageBubble } from "./message-bubble";
import { MessageComposer } from "./composer";

function isOwnMessage(senderId: string, userId: string | undefined): boolean {
  // Seed messages use the CURRENT_USER_SENTINEL directly (see
  // lib/mock/conversations.ts); messages sent live via the composer below
  // carry the real authenticated user's id, so this is a genuine comparison
  // against useAuth().user once the composer is used.
  return senderId === CURRENT_USER_SENTINEL || (!!userId && senderId === userId);
}

export function MessageThread({
  conversation,
  initialMessages,
}: {
  conversation: Conversation;
  initialMessages: MockMessage[];
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [lastSentId, setLastSentId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function handleSend() {
    const body = draft.trim();
    if (!body) return;

    // Optimistic local append only. Real send needs the WebSocket
    // connection once the `messaging` module has a backend (see PLAN.md
    // fase 3) — for now this just updates local state.
    const id = `local-${Date.now()}`;
    setMessages((current) => [
      ...current,
      {
        id,
        senderId: user?.id ?? CURRENT_USER_SENTINEL,
        body,
        sentAt: new Date().toISOString(),
      },
    ]);
    setLastSentId(id);
    setDraft("");
  }

  return (
    <div className="flex min-h-[60vh] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-col gap-1 border-b border-border px-4 py-3 sm:px-5">
        <Link
          href={`/pets/${conversation.listingId}`}
          className="inline-flex w-fit items-center gap-2 text-sm text-muted transition-colors duration-150 hover:text-ink"
        >
          <TypeBadge type={conversation.listingType} />
          <span className="truncate">{conversation.listingTitle}</span>
        </Link>
        <h1 className="truncate text-xl font-semibold text-ink">
          {conversation.otherUser.name}
        </h1>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={isOwnMessage(message.senderId, user?.id)}
            justSent={message.id === lastSentId}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border px-4 py-3 sm:px-5">
        <MessageComposer value={draft} onChange={setDraft} onSend={handleSend} />
      </div>
    </div>
  );
}
