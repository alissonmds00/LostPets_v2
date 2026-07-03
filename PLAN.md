# Plano de execução

Roteiro para retomar a implementação em uma sessão futura. Ver [ARCHITECTURE.md](ARCHITECTURE.md) para o porquê de cada escolha — este documento é só o "o quê, em que ordem".

## Fase 0 — Esqueleto (concluída em 2026-07-03)

- [x] Monorepo com npm workspaces (`apps/api`, `apps/web`)
- [x] Fastify + Zod + Prisma configurados e validados (`/health` respondendo, migration `init` aplicada)
- [x] Módulos `identity/pets/messaging/moderation` como pastas com fronteira definida
- [x] `shared/config`, `shared/errors`, `shared/db`, `shared/storage` (local + S3) implementados
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
- [ ] `POST /api/pets` — cria anúncio (autenticado), aceita upload via `@fastify/multipart`, valida tipo/tamanho, gera thumbnail com `sharp`, salva via `StorageProvider`
- [ ] `GET /api/pets` — lista paginada (offset/limit), filtros por tipo, espécie, cidade, e busca por raio (lat/lng + fórmula de distância em SQL raw via Prisma `$queryRaw`)
- [ ] `GET /api/pets/:id`, `PATCH /api/pets/:id` (só o dono), `DELETE /api/pets/:id` (soft delete, só o dono ou admin)
- [ ] Ao soft-deletar, decidir e implementar o que acontece com as fotos no storage (manter ou remover — hoje em aberto)
- [ ] Testes: unit da fórmula de distância, integração do CRUD e da paginação/filtros

## Fase 3 — `messaging`

- [ ] Modelar `Message` (`senderId`, `receiverId`, `listingId`, `body`, `createdAt`, `readAt`)
- [ ] Rota WebSocket (`@fastify/websocket`) autenticada pela mesma sessão de cookie; validar que a conexão pertence a um usuário logado antes de aceitar
- [ ] Persistir cada mensagem recebida; retransmitir para o destinatário se estiver conectado
- [ ] `GET /api/messaging/:listingId` — histórico paginado de mensagens (REST, para carregar o histórico ao abrir o chat)
- [ ] Testes: handshake de WS autenticado vs. não autenticado, persistência de mensagem

## Fase 4 — `moderation`

- [ ] Modelar `Report` (`reporterId`, `listingId`, `reason`, `status` `PENDING | REVIEWED | DISMISSED`, `createdAt`)
- [ ] `POST /api/moderation/reports` — usuário autenticado denuncia um anúncio
- [ ] `GET /api/moderation/reports` — fila de revisão, só admin (`requireRole('ADMIN')`)
- [ ] `POST /api/moderation/reports/:id/resolve` — admin marca como revisado e opcionalmente remove o anúncio (chama o serviço público de `pets`, nunca a tabela direto)
- [ ] Testes: acesso negado para não-admin, fluxo completo de denúncia → revisão → remoção

## Backlog (fora de ordem, quando fizer sentido)

- [ ] Escolher e montar o `apps/web` (frontend SPA)
- [ ] CI (GitHub Actions): lint + typecheck + testes em cada PR
- [ ] Prefixo de versionamento de API (`/api/v1`) se for útil
- [ ] Job de expiração automática de anúncios antigos (cron/worker)
- [ ] Deploy AWS: escolher entre ECS Fargate / App Runner, RDS, Secrets Manager vs Parameter Store
- [ ] Observabilidade além de log estruturado (se o projeto crescer)
