import { Container } from "@/components/container";
import { IconMessages } from "@/components/icons";
import { ConversationRow } from "@/components/messaging/conversation-row";
import { mockConversations } from "@/lib/mock/conversations";

// WIP: o módulo messaging ainda não tem backend (só README) — ver PLAN.md
// fase 3. A lista abaixo roda sobre estado mock local, mas a tela em si já
// está completa.
export default function ConversationsPage() {
  return (
    <Container className="flex flex-col gap-6 py-10">
      <h1 className="text-2xl font-semibold text-ink">Conversas</h1>

      {mockConversations.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {mockConversations.map((conversation) => (
            <ConversationRow key={conversation.id} conversation={conversation} />
          ))}
        </div>
      )}
    </Container>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-6 py-16 text-center">
      <IconMessages className="h-8 w-8 text-muted" />
      <p className="max-w-sm text-base text-muted">
        Suas conversas aparecem aqui quando você falar com o dono de um anúncio.
      </p>
    </div>
  );
}
