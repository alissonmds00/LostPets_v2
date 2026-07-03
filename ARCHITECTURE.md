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
| Mensagens diretas | WebSocket via `@fastify/websocket`, atrelada a um anúncio | usuário optou por tempo real; sem etapa de aprovação prévia (avaliado e recusado conscientemente) |
| Fotos | Interface `StorageProvider` (`shared/storage`) com driver local (dev) e driver S3 (prod via `@aws-sdk/client-s3`), selecionado por `STORAGE_DRIVER` | mantém a app "pronta para AWS" sem acoplar no S3 agora |
| Upload de foto | Validação de tipo/tamanho + geração de thumbnail (`sharp`) | decisão consciente de aceitar a complexidade extra |
| Geolocalização | lat/lng + fórmula de distância direto na query SQL, sem PostGIS | mantido simples deliberadamente |
| Exclusão | Soft delete (`deletedAt`) em usuários e anúncios | denúncias/moderação precisam referenciar anúncios mesmo depois de removidos |
| Paginação | offset/limit | mais simples de entender e implementar que cursor-based |
| Testes | Vitest, unit + integração contra Postgres real via Docker | usuário quer aprender a testar, não só fazer funcionar |
| Monorepo | npm workspaces (`apps/api`, `apps/web`) | usuário escolheu; frontend (`apps/web`) ainda não tem framework definido |
| Deploy | Docker + docker-compose em dev; alvo AWS (S3 + provavelmente RDS) mais adiante, sem detalhar serviços ainda | 12-factor: config só via env vars, sem estado em disco fora do que é abstraído pelo storage |

## Módulos (bounded contexts)

- **`identity`** — cadastro, login, sessão, perfil, papel do usuário.
- **`pets`** — CRUD de anúncios (perdido/achado/doação), fotos, busca por localização.
- **`messaging`** — mensagens diretas via WebSocket, atreladas a um anúncio.
- **`moderation`** — denúncias contra anúncios, fila de revisão para admin.
- **`shared`** — infraestrutura transversal (storage, cliente Prisma, config, erros); não é módulo de domínio.

**Regra dura:** cada módulo só acessa suas próprias tabelas via seu próprio repositório. Comunicação entre módulos é sempre via chamada ao serviço público exportado do outro módulo — nunca uma query direta cross-module. Isso é o que torna isso um monolito de fato *modular*, não apenas pastas por feature.

**Ordem de implementação** (pela cadeia real de dependência, não uma fase arbitrária): `identity` → `pets` (+ storage) → `messaging` → `moderation`. Ver [PLAN.md](PLAN.md) para o detalhamento executável dessa ordem.

## Convenções já aplicadas no esqueleto

- Erro de API padronizado: `{ error: { code, message, details? } }` ([shared/errors](apps/api/src/shared/errors)).
- Camadas por módulo: `route → service → repository`, repositório é o único ponto que fala com o Prisma.
- CORS com `credentials: true` e origem explícita (não `*`), obrigatório por causa da autenticação via cookie.
- Env vars validadas com Zod na subida da app (`shared/config/env.ts`) — falha rápido e claro em vez de erro tardio em runtime.
- `/health` sem tocar no banco, para health check de orquestração (Docker/ECS).
- Logging estruturado via pino (já embutido no Fastify), com correlação por `x-request-id`.
- ESLint (flat config) + Prettier na raiz do monorepo.
- Convenção de migration do Prisma: `prisma migrate dev` local, `prisma migrate deploy` em CI/prod.

## Pontos em aberto (deferidos conscientemente)

- Framework do frontend (`apps/web`).
- Prefixo de versionamento de API (`/v1`).
- Pipeline de CI (GitHub Actions).
- Especificidades de AWS (Secrets Manager vs Parameter Store, RDS vs Aurora, ECS vs App Runner/Lambda).
- Job de expiração/limpeza automática de anúncios antigos.
- Observabilidade além de log estruturado.
