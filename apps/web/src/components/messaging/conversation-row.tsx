import Link from "next/link";
import { TypeBadge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { Conversation } from "@/lib/mock/conversations";
import { formatRelativeTime } from "./format-time";

export function ConversationRow({ conversation }: { conversation: Conversation }) {
  const hasUnread = conversation.unreadCount > 0;

  return (
    <Link
      href={`/messages/${conversation.id}`}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-transparent px-3 py-3 transition-colors duration-150",
        "hover:bg-surface active:bg-surface-2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <TypeBadge type={conversation.listingType} />
          <span className="truncate text-sm text-muted">{conversation.listingTitle}</span>
        </div>
        <span
          className={cn(
            "truncate text-base",
            hasUnread ? "font-semibold text-ink" : "font-medium text-ink",
          )}
        >
          {conversation.otherUser.name}
        </span>
        <p className={cn("truncate text-sm", hasUnread ? "text-ink" : "text-muted")}>
          {conversation.lastMessage}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-xs text-muted">
          {formatRelativeTime(conversation.lastMessageAt)}
        </span>
        {hasUnread && (
          <span
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-ink"
            aria-label={`${conversation.unreadCount} mensagens não lidas`}
          >
            {conversation.unreadCount}
          </span>
        )}
      </div>
    </Link>
  );
}
