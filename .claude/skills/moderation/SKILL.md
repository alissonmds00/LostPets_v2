---
name: moderation
description: >
  Documenta a convenção já decidida neste projeto para o módulo `moderation` (denúncias contra
  anúncios, fila de revisão pra admin, resolução). Use esta skill sempre que o usuário pedir para
  mexer em denúncia, revisão de anúncio, ou no fluxo de resolver/remover um anúncio denunciado —
  ex: "muda o fluxo de denúncia", "como funciona resolver uma denúncia", "adiciona um status novo
  de moderação". Aplique a convenção documentada abaixo antes de escrever qualquer código; se a
  situação não estiver coberta por ela, não decida sozinho — acione a skill pattern-advisor para
  resolver a lacuna com o usuário.
---

# Moderation (denúncias e revisão)

## Decisão (registrada em 2026-07-09)

- **`Report.status` tem 3 valores alcançáveis: `PENDING | REVIEWED | DISMISSED`.** `DISMISSED` é um
  desfecho de verdade (denúncia considerada inválida), não um valor do enum que nunca é setado por
  nenhuma rota.
- **Resolver uma denúncia usa um único campo `outcome: 'DISMISSED' | 'REVIEWED_KEPT' |
  'REVIEWED_REMOVED'`** no body de `POST /reports/:id/resolve` — não dois campos separados
  (`status` + `remove: boolean`). Um campo só evita combinação inválida (ex: `DISMISSED` +
  `remove: true`, que não faz sentido). `REVIEWED_KEPT`/`REVIEWED_REMOVED` colapsam pro mesmo
  `Report.status` (`REVIEWED`) — a diferença entre os dois é só se o anúncio também é removido.
- **`REVIEWED_REMOVED` reusa `DELETE /api/pets/:id` já existente** (`PetsService.deleteListing`,
  soft delete via `deletedAt`) em vez de um mecanismo de remoção próprio de moderação
  (`deactivateListing`/`status: CANCELLED`). Como a rota de resolve exige `requireRole('ADMIN')`,
  `requesterRole: 'ADMIN'` sempre passa na checagem dono-ou-admin de `deleteListing` — não há
  necessidade de duplicar a semântica de "remover anúncio" em dois lugares diferentes do código.
- **Onde essa orquestração mora:** `shared/usecases/resolve-report.usecase.ts` — cruza `moderation`
  (`ModerationService.resolveReport`, só mexe no `Report`) e `pets`
  (`PetsService.deleteListing`, só chamado se `outcome === 'REVIEWED_REMOVED'`). `ModerationService`
  nunca chama `PetsService` direto.
- **Múltiplas denúncias do mesmo usuário pro mesmo anúncio são permitidas** — sem
  `@@unique([reporterId, listingId])`. Mais denúncias sobre o mesmo anúncio é sinal de prioridade
  pra revisão, não ruído a ser bloqueado.
- **Resolver uma denúncia que já não está `PENDING` retorna 409** (`ReportAlreadyResolvedError`),
  não um no-op silencioso — torna erro de operador (ex: dois admins resolvendo a mesma denúncia ao
  mesmo tempo, ou double-click) visível em vez de mascarado.
- **`GET /api/moderation/reports` lista só `PENDING`, sem filtro de status nem paginação por
  enquanto** — é a fila de revisão, não um histórico completo. Decisão consciente de YAGNI: revisar
  com `pattern-advisor` se um filtro/paginação virar necessidade real.

**Alternativas consideradas:**
- `PetsService.deactivateListing` com um novo status `CANCELLED` dedicado a moderação — rejeitada
  depois que o `DELETE /api/pets/:id` completo (dono-ou-admin, soft delete) já existia: manter os
  dois mecanismos de remoção coexistindo (um por moderação, outro pelo dono) duplicaria a mesma
  regra de negócio sem necessidade.
- `status` + `remove: boolean` separados no body de resolve — rejeitada por permitir combinações
  sem sentido (ver acima).

## Como aplicar

Ao mexer no módulo `moderation`:
1. Qualquer regra que precise tocar em `pets` (hoje: remover o anúncio ao resolver) fica em
   `shared/usecases/`, nunca dentro de `ModerationService`/`ModerationRepository`.
2. Novo desfecho de resolve (`outcome`): estende o enum Zod `resolveReportOutcomeSchema` em
   `moderation.schema.ts` e decide explicitamente pra qual `Report.status` ele colapsa — não
   assuma, isso é uma decisão nova se não for óbvio.
3. Teste (skill `testing`): repository mocka `PrismaClient`; service mocka o repository;
   `resolveReportUsecase` (cross-module) mocka `ModerationService` E `PetsService`, verificando que
   `deleteListing` só é chamado quando `outcome === 'REVIEWED_REMOVED'`; rota usa `app.inject()`
   com `moderationService`/`petsService` mockados via `buildApp(env, overrides)`.

## Se algo não estiver coberto aqui

Isso indica uma decisão nova (ex: notificar o dono do anúncio quando removido, permitir apelação de
uma denúncia resolvida, filtro/paginação em `GET /reports`, banir um usuário por denúncias
repetidas). Não resolva sozinho — acione a skill `pattern-advisor` para decidir isso com o usuário,
e depois atualize esta skill com o resultado.
