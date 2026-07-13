import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { MessageThread } from "@/components/messaging/message-thread";
import {
  getMockConversationById,
  getMockThreadMessages,
} from "@/lib/mock/conversations";

// WIP: o chat em tempo real ainda não tem backend (WebSocket + persistência
// de mensagens) — ver PLAN.md fase 3. A conversa abaixo roda inteiramente
// contra estado mock local (interativa, com envio otimista), mas a tela em
// si já está completa.
export default async function ConversationThreadPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const conversation = getMockConversationById(conversationId);

  if (!conversation) {
    notFound();
  }

  const initialMessages = getMockThreadMessages(conversationId);

  return (
    <Container className="flex flex-1 flex-col gap-4 py-6 sm:py-10">
      <MessageThread conversation={conversation} initialMessages={initialMessages} />
    </Container>
  );
}
