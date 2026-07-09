# Plano de execução

Roteiro para retomar a implementação em uma sessão futura. Ver [ARCHITECTURE.md](ARCHITECTURE.md) para o porquê de cada escolha — este documento é só o "o quê, em que ordem".

## Fase 0 — Esqueleto (concluída em 2026-07-03)

- [x] Monorepo com npm workspaces (`apps/api`, `apps/web`)
- [x] Fastify + Zod + Prisma configurados e validados (`/health` respondendo, migration `init` aplicada)
- [x] Módulos `identity/pets/messaging/moderation` como pastas com fronteira definida
- [x] `shared/config`, `shared/errors`, `shared/db` implementados; `gateways/storage.gateway.service.ts` (local + S3) implementado
- [x] `gateways/pets-registration-queue.gateway.service.ts` (produtor SQS) implementado; LocalStack 4.12.0 no `docker-compose.yml` pra simular a fila em dev
- [x] docker-compose (Postgres na porta host `5433` — 5432 pode estar ocupado por um Postgres nativo local)
- [x] Vitest configurado, 1 teste passando (`test/health.test.ts`)
- [x] ESLint + Prettier na raiz

## Fase 1 — `identity`

- [ ] Modelagem já existe no `schema.prisma` (`User`, `Session`); revisar se falta algum campo antes de avançar (ex: `name` obrigatório faz sentido? confirmar com o usuário se necessário)
- [ ] `POST /api/identity/register` — valida com Zod, verifica e-mail único, hash de senha com argon2, cria `User`
- [ ] `POST /api/identity/login` — valida credenciais, cria `Session` no banco, seta cookie httpOnly (`SESSION_COOKIE_NAME`)
- [ ] `POST /api/identity/logout` — apaga a `Session` correspondente, limpa o cookie
- [ ] Plugin/hook de autenticação: lê o cookie, busca a `Session` válida (não expirada), anexa `request.user`; expor um helper `requireAuth` e `requireRole('ADMIN')` para as rotas
- [ ] `GET /api/identity/me` — retorna o usuário autenticado (401 se não houver sessão)
- [ ] Rate limit dedicado em `/register` e `/login` (`@fastify/rate-limit` por rota, não só global)
- [ ] Testes: unit do hashing/validação, integração batendo nas rotas reais contra o Postgres do Docker
- [ ] Remover a rota placeholder `GET /ping` do módulo

## Fase 2 — `pets` (+ storage)

- [ ] Modelar no `schema.prisma`: `PetListing` (tipo `LOST | FOUND | DONATION`, título, descrição, espécie, lat/lng, cidade, `status` `ACTIVE | RESOLVED | CANCELLED`, `ownerId`, `deletedAt`), `PetPhoto` (chave de storage, url, ordem, `listingId`)
- [ ] `POST /api/pets` — cria anúncio (autenticado), aceita upload via `@fastify/multipart`, valida tipo/tamanho, gera thumbnail com `sharp`, salva via `StorageGateway`; o registro em si é assíncrono — o usecase valida e publica na fila via `PetsRegistrationQueueGateway` (`enqueue-then-persist`, decidido em 2026-07-04 pra não perder cadastro se o banco estiver sobrecarregado), a rota responde 202, e um consumidor separado persiste no Postgres depois
- [x] Consumidor da fila: `modules/pets/pets-registration.consumer.ts`, rodando dentro do próprio `apps/api` (sem `apps/worker` separado), usando `sqs-consumer` por dentro do gateway (`PetsRegistrationQueueGatewayService.startConsuming`/`stopConsuming`, decisão reaberta em 2026-07-09 — ver skill `queue`); consumidor chama `PetsService.registerListing` pra persistir, nunca grava direto na tabela
- [x] `GET /api/pets` — lista paginada (offset/limit, default 20, máximo 100; sem filtro de status só retorna `ACTIVE`), filtros por tipo, espécie, cidade, e busca por raio (lat/lng/radiusKm juntos ou nenhum — SQL raw via Prisma `$queryRaw`, decidido com o usuário em 2026-07-09)
- [x] `GET /api/pets/:id`, `PATCH /api/pets/:id` (só o dono), `DELETE /api/pets/:id` (soft delete, dono ou admin)
- [x] Ao soft-deletar, fotos permanecem no storage (decidido com o usuário em 2026-07-09 — preserva evidência para revisão de moderação)
- [x] Testes: unit da query de raio (repository, mockando `PrismaClient`), verificação manual da fórmula de Haversine contra Postgres real, e integração do CRUD/paginação/filtros (service e rota, mockando o service)

## Fase 3 — `messaging`

- [ ] Modelar `Message` (`senderId`, `receiverId`, `listingId`, `body`, `createdAt`, `readAt`)
- [ ] Rota WebSocket (`@fastify/websocket`) autenticada pela mesma sessão de cookie; validar que a conexão pertence a um usuário logado antes de aceitar
- [ ] Persistir cada mensagem recebida; retransmitir para o destinatário se estiver conectado
- [ ] `GET /api/messaging/:listingId` — histórico paginado de mensagens (REST, para carregar o histórico ao abrir o chat)
- [ ] Testes: handshake de WS autenticado vs. não autenticado, persistência de mensagem

## Fase 4 — `moderation`

- [x] Modelar `Report` (`reporterId`, `listingId`, `reason`, `status` `PENDING | REVIEWED | DISMISSED`, `createdAt`); múltiplas denúncias do mesmo usuário pro mesmo anúncio são permitidas (sem unique constraint)
- [x] `POST /api/moderation/reports` — usuário autenticado denuncia um anúncio
- [x] `GET /api/moderation/reports` — fila de revisão, só admin (`requireRole('ADMIN')`); lista só `PENDING`, sem filtro de status por enquanto
- [x] `POST /api/moderation/reports/:id/resolve` — admin resolve com um `outcome` único (`DISMISSED | REVIEWED_KEPT | REVIEWED_REMOVED`, decidido com o usuário em 2026-07-09 em vez de dois campos separados); `REVIEWED_REMOVED` reusa o `DELETE /api/pets/:id` já existente (`PetsService.deleteListing`) via `shared/usecases/resolve-report.usecase.ts`, que orquestra `moderation` e `pets` — nunca o service ou a tabela de outro módulo direto; resolver uma denúncia já resolvida retorna 409 — ver skill `moderation`
- [x] Testes: acesso negado para não-admin, fluxo completo de denúncia → revisão → remoção (unit em cada camada + verificação manual do fluxo completo via HTTP real contra Postgres real, confirmando o soft-delete do anúncio)

## Backlog (fora de ordem, quando fizer sentido)

- [ ] Escolher e montar o `apps/web` (frontend SPA)
- [ ] CI (GitHub Actions): lint + typecheck + testes em cada PR
- [ ] Prefixo de versionamento de API (`/api/v1`) se for útil
- [ ] Job de expiração automática de anúncios antigos (cron/worker)
- [ ] Deploy AWS: escolher entre ECS Fargate / App Runner, RDS, Secrets Manager vs Parameter Store
- [ ] Observabilidade além de log estruturado (se o projeto crescer)
