# Lost Pets — Arquitetura

Sistema para divulgação de pets perdidos, encontrados e para doação. Monolito modular em Node/TypeScript, projeto de aprendizado/portfólio, com deploy alvo em AWS (local em Docker por enquanto).

> Este documento substitui uma versão anterior (baseada em NestJS/Jest/PostGIS/fluxo de aprovação de contato) que ficou sem commit. As decisões abaixo foram tomadas em entrevista com o usuário em 2026-07-02/03 e são as que valem.

## Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Runtime/Linguagem | Node.js + TypeScript | requisito do usuário |
| Framework HTTP | Fastify | usuário já tinha experiência prévia; encapsulamento por plugins ajuda a impor fronteiras entre módulos sem introduzir um segundo framework novo (NestJS) enquanto aprende arquitetura modular |
| Banco | PostgreSQL | dados fortemente relacionais (dono do anúncio, mensagens, denúncias) |
| ORM | Prisma | tipagem TS gerada, migrations previsíveis, curva de aprendizado baixa |
| Validação | Zod (`fastify-type-provider-zod`) | schemas viram tipos TS automaticamente |
| Autenticação | Cookie de sessão httpOnly (`@fastify/cookie`), tabela `sessions` no Postgres, hash de senha com `argon2` | mais seguro contra XSS que JWT em localStorage; sem lógica de refresh token no frontend |
| Autorização | Campo `role` no usuário (`USER` / `ADMIN`) | suficiente para moderação, sem RBAC complexo |
| Mensagens diretas | WebSocket via `@fastify/websocket`, atrelada a um anúncio; só quem é dono do anúncio ou já está numa conversa com ele pode enviar (checagem cross-module `pets`+`messaging` em `shared/usecases/send-message.usecase.ts`); registro de quem está conectado é um singleton module-local (`MessagingConnectionRegistry`, fora do padrão de DI do resto do projeto); `readAt` é delivery receipt, não "usuário leu" | usuário optou por tempo real; sem etapa de aprovação prévia (avaliado e recusado conscientemente) — ver skill `messaging` |
| Fotos | Gateway `createStorageGateway` (`gateways/storage.gateway.service.ts`), escolhe `LocalStorageGateway` (dev) vs `S3StorageGateway` (prod via `@aws-sdk/client-s3`) por `STORAGE_DRIVER` | mantém a app "pronta para AWS" sem acoplar no S3 agora |
| Cadastro de pet | Fila SQS via `PetsRegistrationQueueGatewayService` (`gateways/pets-registration-queue.gateway.service.ts`) — LocalStack (dev, `SQS_ENDPOINT`) e SQS real (prod) são o mesmo protocolo, só muda o endpoint, então é uma classe única (não a exceção usada em storage); consumidor usa a lib `sqs-consumer` por dentro do gateway (`startConsuming`/`stopConsuming`), sem expor o `SQSClient` cru | evita perder o cadastro se o banco estiver sobrecarregado: a rota enfileira e responde, um consumidor assíncrono (`modules/pets/pets-registration.consumer.ts`, dentro do módulo por conter parsing/validação específica de `pets`) persiste depois via `PetsService.registerListing` — ver skill `queue` |
| Upload de foto | Validação de tipo/tamanho + geração de thumbnail (`sharp`) | decisão consciente de aceitar a complexidade extra |
| Geolocalização | lat/lng + fórmula de distância direto na query SQL, sem PostGIS | mantido simples deliberadamente |
| Exclusão | Soft delete (`deletedAt`) em usuários e anúncios | denúncias/moderação precisam referenciar anúncios mesmo depois de removidos |
| Moderação | `Report` com 3 status (`PENDING`/`REVIEWED`/`DISMISSED`); resolver usa um único campo `outcome` (`DISMISSED`/`REVIEWED_KEPT`/`REVIEWED_REMOVED`), nunca dois campos separados; `REVIEWED_REMOVED` reusa `PetsService.deleteListing` (o `DELETE /api/pets/:id` já existente) via `shared/usecases/resolve-report.usecase.ts`, sem um mecanismo de remoção próprio da moderação | evita duplicar a semântica de "remover anúncio" em dois lugares; `requireRole('ADMIN')` na rota de resolve já garante que a checagem dono-ou-admin de `deleteListing` sempre passa — ver skill `moderation` |
| Paginação | offset/limit | mais simples de entender e implementar que cursor-based |
| Testes | Vitest; nenhuma camada automatizada toca infra real (repository mocka `PrismaClient`, service mocka repository/gateway, usecase/rota mocka o service); Docker é só para dev local e QA validado manualmente | usuário quer aprender a testar, não só fazer funcionar |
| Monorepo | npm workspaces (`apps/api`, `apps/web`) | usuário escolheu |
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS, scaffolded via `create-next-app`; telas iniciais construídas sobre dados mock (`apps/web/src/lib/mock/`), ainda não ligadas à API real (decidido em 2026-07-11) | App Router é o padrão atual recomendado pelo próprio Next; sem ESLint próprio no `apps/web` (`--no-linter` na criação) para manter o único `eslint.config.js` da raiz cobrindo o repo inteiro, como já era feito pra `apps/api` |
| Deploy | Docker + docker-compose em dev; alvo AWS (S3 + provavelmente RDS) mais adiante, sem detalhar serviços ainda | 12-factor: config só via env vars, sem estado em disco fora do que é abstraído pelo storage |

## Módulos (bounded contexts)

- **`identity`** — cadastro, login, sessão, perfil, papel do usuário.
- **`pets`** — CRUD de anúncios (perdido/achado/doação), fotos, busca por localização.
- **`messaging`** — mensagens diretas via WebSocket, atreladas a um anúncio.
- **`moderation`** — denúncias contra anúncios, fila de revisão para admin.
- **`infra`** — camada técnica/de infraestrutura (cliente Prisma, config de env, classes de erro, exception
  handler global); não é módulo de domínio, não tem lógica de negócio.
- **`shared`** — conceitos de domínio genuinamente compartilhados entre módulos (ex: enum `Role`); não é
  módulo de domínio.
- **`gateways`** — integração com sistemas externos (hoje: storage); não é módulo de domínio, ver skill `gateway`.

**Regra dura:** cada módulo só acessa suas próprias tabelas via seu próprio repositório. Um
service **nunca** chama o service de outro módulo — comunicação entre módulos acontece
exclusivamente na camada de usecase, que orquestra os services dos módulos envolvidos. Isso é o
que torna isso um monolito de fato *modular*, não apenas pastas por feature.

**Ordem de implementação** (pela cadeia real de dependência, não uma fase arbitrária): `identity` → `pets` (+ storage) → `messaging` → `moderation`. Ver [PLAN.md](PLAN.md) para o detalhamento executável dessa ordem.

## Convenções já aplicadas no esqueleto

- Erro de API padronizado: `{ error: { code, message, details? } }` ([infra/errors](apps/api/src/infra/errors)).
- Camadas: `route → usecase → service → repository`. Toda rota chama um usecase, nunca o service
  diretamente; usecase que orquestra só o próprio módulo mora dentro dele
  (`modules/<módulo>/<operação>.usecase.ts`); usecase que cruza mais de um módulo mora em
  `apps/api/src/shared/usecases/<operação>.usecase.ts` (ex:
  `shared/usecases/send-message.usecase.ts`, que cruza `pets` + `messaging`, e
  `shared/usecases/resolve-report.usecase.ts`, que cruza `moderation` + `pets`); cada service só
  chama o repository do próprio módulo; repositório é o único ponto que fala com o Prisma. Ver
  skills `controller` e `usecase` em `.claude/skills/` para o detalhe de cada camada.
- CORS com `credentials: true` e origem explícita (não `*`), obrigatório por causa da autenticação via cookie.
- Env vars validadas com Zod na subida da app (`infra/config/env.ts`) — falha rápido e claro em vez de erro tardio em runtime.
- `/health` sem tocar no banco, para health check de orquestração (Docker/ECS).
- Logging estruturado via pino (já embutido no Fastify), com correlação por `x-request-id`; access
  log (método/rota/status/duração) com serializers explícitos pra nunca logar headers/cookie de
  sessão — ver skill `logging`.
- ESLint (flat config) + Prettier na raiz do monorepo.
- Convenção de migration do Prisma: `prisma migrate dev` local, `prisma migrate deploy` em CI/prod.
- Encerramento gracioso em `SIGTERM`/`SIGINT` (`server.ts`): para o consumidor da fila, fecha o app (aguardando requests em andamento) e desconecta o Prisma via o hook `onClose`.

## Pontos em aberto (deferidos conscientemente)

- Ligar as telas do frontend (`apps/web`) à API real — hoje rodam sobre dados mock.
- Prefixo de versionamento de API (`/v1`).
- Pipeline de CI (GitHub Actions).
- Especificidades de AWS (Secrets Manager vs Parameter Store, RDS vs Aurora, ECS vs App Runner/Lambda).
- Job de expiração/limpeza automática de anúncios antigos.
- Observabilidade além de log estruturado.
