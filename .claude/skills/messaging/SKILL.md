---
name: messaging
description: >
  Documenta a convenção já decidida neste projeto para o módulo `messaging` (mensagens diretas via
  WebSocket, atreladas a um anúncio de pet). Use esta skill sempre que o usuário pedir para mexer
  no chat, nas mensagens diretas, na conexão WebSocket, ou no histórico de conversas — ex: "muda o
  fluxo de mensagens", "adiciona um evento novo no chat", "como funciona a entrega de mensagem".
  Aplique a convenção documentada abaixo antes de escrever qualquer código; se a situação não
  estiver coberta por ela, não decida sozinho — acione a skill pattern-advisor para resolver a
  lacuna com o usuário.
---

# Messaging (chat via WebSocket)

## Decisão (registrada em 2026-07-09)

- **Quem pode iniciar uma conversa:** só é possível trocar mensagens sobre um anúncio se um dos
  dois lados (remetente ou destinatário) for o dono do anúncio — nunca dois usuários quaisquer
  conversando "em nome" de um anúncio de terceiros. Não-dono só pode mandar a primeira mensagem
  pro dono; o dono responde dentro da conversa já existente (o `receiverId` já vem do cliente,
  escolhido a partir de quem já mandou mensagem antes).
- **Onde essa checagem mora:** em `shared/usecases/send-message.usecase.ts` — cruza `pets` (lê
  `PetsService.getListing` pra saber o `ownerId`) e `messaging` (chama `MessagingService.sendMessage`
  só se a checagem passar). Nunca dentro de `MessagingService`, que não conhece `pets`.
- **Registro de conexão (quem está online):** `MessagingConnectionRegistry`, um `Map<userId,
  Set<WebSocket>>` (múltiplos sockets por usuário — várias abas/dispositivos). Fica em
  `modules/messaging/messaging-connection.registry.ts` como **singleton module-local** (instância
  exportada no próprio arquivo), não passa por `app.decorate`/DI — é o único componente deste
  projeto que quebra esse padrão, porque não é uma dependência de negócio substituível, é estado de
  processo (quem está conectado agora). A rota importa o singleton direto pra
  registrar/desregistrar na conexão; `MessagingService` recebe a mesma instância por parâmetro de
  construtor (montada em `app.ts` importando o singleton, não uma nova instância).
- **`readAt` é delivery receipt, não "usuário leu"**: setado quando a mensagem é entregue com
  sucesso a pelo menos um socket aberto do destinatário no momento do envio (`socket.send(...)`
  bem-sucedido), não quando o destinatário efetivamente abre a conversa. Destinatário offline:
  mensagem fica só persistida, `readAt` continua `null`.
- **Falha de autenticação na rota WS retorna 401 no upgrade**, igual qualquer rota autenticada:
  `preHandler: app.requireAuth` roda antes do upgrade pro protocolo WebSocket (hooks normais do
  Fastify — `@fastify/websocket` confirma isso no próprio README), então uma sessão inválida nunca
  chega a abrir o socket.
- **Histórico (`GET /api/messaging/:listingId`) não recebe o outro participante na URL** — só
  `listingId`. Pra não vazar conversas de terceiros, o repository filtra por participante
  (`WHERE listingId = X AND (senderId = requesterId OR receiverId = requesterId)`), nunca todas as
  mensagens do anúncio. Efeito colateral aceito conscientemente: se o dono tiver mais de uma
  conversa sobre o mesmo anúncio (vários não-donos mandando mensagem), o histórico do dono vem com
  todas misturadas, ordenadas só por `createdAt` — o frontend que separa por outro participante se
  precisar. Decidido com o usuário depois de identificar essa ambiguidade durante a implementação;
  alternativa considerada (`GET /:listingId/:otherUserId`, mesma granularidade da rota WS) foi
  proposta e recusada em favor de manter a URL como o PLAN.md original já descrevia.

**Alternativas consideradas:**
- `MessagingConnectionRegistry` como dependência decorada via `app.decorate` (mesmo padrão de
  repository/service) — rejeitada: é estado de conexão em memória, não uma dependência substituível
  por um mock em teste de rota (os testes de rota usam `injectWS` contra o registro real).
- Checagem de "quem pode conversar com quem" dentro de `MessagingService` — rejeitada: exigiria
  `MessagingService` chamar `PetsService` direto, violando a regra dura de que nenhum service chama
  o service de outro módulo (ver `ARCHITECTURE.md` e skill `usecase`).

## Como aplicar

Ao mexer no módulo `messaging`:
1. Qualquer regra que precise saber quem é o dono do anúncio (ou qualquer outro dado de `pets`) fica
   em `shared/usecases/`, nunca dentro de `MessagingService`/`MessagingRepository`.
2. Novo evento/tipo de frame WS: schema Zod em `messaging.schema.ts`, parseado manualmente dentro do
   handler `socket.on('message', ...)` (WS não valida frame a frame via Fastify, só os `params` da
   conexão inicial passam pelo schema da rota).
3. Qualquer coisa que precise saber "quem está conectado agora" usa o singleton
   `messagingConnectionRegistry` importado direto — não cria um segundo registro nem tenta
   decorá-lo em `app`.
4. Teste (skill `testing`): repository mocka `PrismaClient`; service mocka o repository E usa o
   `MessagingConnectionRegistry` real (é só um Map em memória, testar contra a implementação real é
   mais direto que mockar); rota usa `app.injectWS(...)` (real do `@fastify/websocket`, confirmado
   funcional na versão instalada) pra WS e `app.inject()` pra REST, com `petsService`/
   `messagingService` mockados via `buildApp(env, overrides)`.

## Se algo não estiver coberto aqui

Isso indica uma decisão nova (ex: grupos de mensagem com mais de dois participantes, notificação
push pra usuário offline, edição/exclusão de mensagem, rate limit no envio). Não resolva sozinho —
acione a skill `pattern-advisor` para decidir isso com o usuário, e depois atualize esta skill com
o resultado.
