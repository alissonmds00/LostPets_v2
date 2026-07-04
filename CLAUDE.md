# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Lost Pets — a learning/portfolio project: a modular monolith (Node/TypeScript) for posting lost, found, and donation pet listings. See [ARCHITECTURE.md](ARCHITECTURE.md) for the full stack rationale and [PLAN.md](PLAN.md) for the phase-by-phase build order and current status (as of 2026-07-03: only the skeleton + `/health` exist; `identity` is scaffolded but not implemented).

npm workspaces monorepo: `apps/api` (Fastify, implemented) and `apps/web` (frontend, framework not yet chosen — placeholder only).

## Commands

All from repo root unless noted.

```
npm run dev:api        # run the API with watch mode (tsx watch src/server.ts)
npm run build:api      # tsc build of apps/api
npm run test:api       # vitest run (apps/api)
npm run lint           # eslint . (whole repo, flat config)
npm run format         # prettier --write .
```

Inside `apps/api` directly:

```
npm run test:watch                 # vitest in watch mode
npx vitest run test/health.test.ts # run a single test file
npx vitest run -t "returns ok"     # run tests matching a name
npm run prisma:generate            # regenerate Prisma client after schema.prisma changes
npm run prisma:migrate             # create + apply a dev migration
npm run prisma:deploy              # apply pending migrations (CI/prod)
```

Postgres runs via Docker (`docker-compose.yml`), exposed on host port **5433** (not 5432, to avoid clashing with a local Postgres install):

```
docker compose up -d postgres
```

`apps/api` needs a local `.env` (see `apps/api/.env.example`) — `DATABASE_URL`, `SESSION_COOKIE_SECRET` (32+ chars, e.g. `openssl rand -base64 32`), `CORS_ORIGIN`, `STORAGE_DRIVER`, etc. Env vars are validated with Zod on boot (`shared/config/env.ts`) and the app exits immediately with a clear error if config is invalid.

Tests are Vitest; integration tests are meant to run against a real Postgres (via Docker), not mocks — per [ARCHITECTURE.md](ARCHITECTURE.md), that's a deliberate choice for this project since testing itself is a learning goal. Tests are written before the implementation at every layer (repository, service, usecase) and a task isn't done until they're actually run and passing — see the `testing` skill for the full red-green workflow.

## Architecture

Every code-shaped pattern below (controller, dto, usecase, service, gateway, repository, enum,
exception-handler, swagger, testing) is documented in detail as its own skill in
`.claude/skills/<pattern>/` — those are the source of truth for how to implement each layer; this
section is only the map.

### Module boundaries (hard rule)

`apps/api/src/modules/{identity,pets,messaging,moderation}` are bounded contexts. **A module only queries its own tables through its own repository.** A service **never** calls another module's service directly — cross-module communication happens exclusively in the usecase layer (`apps/api/src/usecases/`), which orchestrates the services of the modules involved. This is what makes it a *modular* monolith rather than folders-by-feature; don't break this boundary when wiring new features together (e.g. `moderation` removing a listing must go through a usecase that orchestrates `moderation` and `pets`, never a direct call between their services).

Each module is internally layered `route → usecase → service → repository`. Every route calls a usecase — even single-module CRUD, there's no `route → service` shortcut. The service is the only thing that calls its own module's repository and applies business rules; the repository is the only thing that talks to Prisma; the service is also the only layer allowed to call a gateway (`apps/api/src/gateways/`) for external-system integration (see "Gateways" below). DTOs (`<module>.dto.ts`, `z.infer` of the module's Zod schemas) are what every layer — route, usecase, service, repository — actually passes around, never the raw Zod schema or a Prisma-generated type.

`apps/api/src/shared/` is cross-cutting, not a domain module: `config` (env loading), `errors` (the `AppError` hierarchy — just the error classes), `infra` (the global exception handler, see below), `db` (Prisma client), `enums` (enums shared across more than one module — module-specific enums live inside their own module instead).

`apps/api/src/gateways/` holds integration with external systems (today: storage/S3). Not a domain module, and not inside `shared/` — see "Gateways" below.

### Request flow

`src/server.ts` loads env and calls `buildApp(env)` from `src/app.ts`, which wires Fastify plugins (cors, cookie, rate-limit, zod validators/serializers), the global exception handler, `/health`, and registers each module under `/api/<module>`. New modules get registered here as they're built (currently only `identityModule` at `/api/identity`; it currently only exposes a placeholder `/ping`).

### Exception handling

Centralize the handling, decentralize the creation: errors are thrown where the business rule lives (in a module), but all of them are caught in one place — the global exception handler (`formatErrorResponse` in `shared/infra/exception-handler.ts`, registered via `app.setErrorHandler(...)`). It works generically off `instanceof AppError` (4xx, business error, carries its own `statusCode`/`code`/`message`/`details`) vs. anything else (500, treated as a bug, no detail leaked) — adding a new error class never requires touching this handler. Always `throw new SomeSpecificError(...)`, never a raw string/object.

Generic, reusable-anywhere errors (`NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`) live in `shared/errors/app-error.ts`. An error tied to one module's business rule gets its own subclass in `modules/<module>/errors.ts` instead of being forced into a generic one.

### Gateways (external service integration)

A gateway is the repository's counterpart for the outside world: the one place that talks to a given external system, with no business logic in it — just config/credentials and translating between the domain's shape and whatever that external system expects/returns. Only the service layer calls a gateway (never a route, usecase, or repository). Gateways are concrete classes with no interface/swappable-driver layer, named `<service>.gateway.ts` in `apps/api/src/gateways/`. `StorageGateway` (`gateways/storage.gateway.ts`) is the current example — it decides local-disk vs. S3 internally based on `STORAGE_DRIVER`, replacing an earlier `StorageProvider` interface+driver design.

### Enums

Finite-value fields (status, role, type) are always an enum, with full-word values (`ACTIVE`, not `A` or `1`), never a raw string/number compared inline. If the value is a Prisma column, it's declared once in `schema.prisma` and reused everywhere else via `z.nativeEnum(...)`, wrapped in a single `<name>.enum.ts` file per enum (e.g. `shared/enums/role.enum.ts`) so the `@prisma/client` import stays contained to that one file — an explicit, scoped exception to "only the repository talks to Prisma." Non-persisted enums are declared directly with `z.enum([...] as const)`. Enums used by more than one module live in `shared/enums/`; module-specific ones live inside that module.

### API documentation (Swagger/OpenAPI)

`@fastify/swagger` + `@fastify/swagger-ui`, registered in `app.ts` only outside production, using `jsonSchemaTransform` from `fastify-type-provider-zod` to turn the routes' existing Zod schemas into the OpenAPI spec — no schema duplicated just for docs. UI at `/docs`, raw spec at `/docs/json`. A route's `summary`/`description`/`tags` live inline in that route's `schema` object (not in `schemas.ts`); field-level description uses Zod's `.describe()`. No per-field example values yet (see the `swagger` skill for why and what would change that).

### Auth model (identity module — not yet implemented, see PLAN.md Phase 1)

Session-based, not JWT: httpOnly cookie (`@fastify/cookie`) + a `sessions` table in Postgres, password hashing via `argon2`. Authorization is a simple `role` enum (`USER`/`ADMIN`) on `User`, checked via planned `requireAuth`/`requireRole('ADMIN')` helpers — no general RBAC. CORS is configured with `credentials: true` and an explicit origin (never `*`), which is required for cookie-based auth to work cross-origin.

### Data model conventions

- Soft delete via `deletedAt` (not hard delete) on `User` and future `PetListing`, so moderation/reports can still reference removed listings.
- Geolocation is plain `lat`/`lng` columns with a distance formula in raw SQL (Prisma `$queryRaw`) — PostGIS was deliberately skipped for simplicity.
- Pagination is offset/limit, not cursor-based.
- Prisma schema (`apps/api/prisma/schema.prisma`) is organized in comment-delimited sections per module phase; add new models under the relevant phase section, matching the module that owns them.
