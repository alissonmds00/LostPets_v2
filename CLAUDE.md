# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Lost Pets — a learning/portfolio project: a modular monolith (Node/TypeScript) for posting lost, found, and donation pet listings. See [ARCHITECTURE.md](ARCHITECTURE.md) for the full stack rationale and [PLAN.md](PLAN.md) for the phase-by-phase build order and current status — `identity`, `pets`, `messaging`, and `moderation` are all implemented, each registered under `/api/<module>` (see "Request flow" below). Check PLAN.md's checkboxes for the exact current state before assuming a piece of a phase is done or missing.

npm workspaces monorepo: `apps/api` (Fastify) and `apps/web` (Next.js App Router, TypeScript, Tailwind CSS — scaffolded via `create-next-app`; initial screens are built but run on mock data, not yet wired to the real API).

## Commands

All from repo root unless noted.

```
npm run dev:api        # run the API with watch mode (tsx watch src/server.ts)
npm run build:api      # tsc build of apps/api
npm run test:api       # vitest run (apps/api)
npm run dev:web        # run the Next.js dev server (apps/web), Turbopack, http://localhost:3000
npm run build:web      # next build (apps/web)
npm run lint           # eslint . (whole repo, flat config — apps/web has no separate ESLint config, it's linted by this same root config)
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

Postgres runs via Docker (`docker-compose.yml`), exposed on host port **5433** (not 5432, to avoid clashing with a local Postgres install). `docker-compose.yml` also runs LocalStack (SQS) — self-provisioning the queues this project needs via an init hook (`infra/localstack/init/`), with a healthcheck that waits for that provisioning, not just for the container to be up — and an `api` service that builds and runs the app itself:

```
docker compose up -d postgres localstack   # host-run dev (npm run dev:api) only needs these two
docker compose up                          # runs api too, wired to postgres/localstack by compose service name
```

`apps/api` needs a local `.env` (see `apps/api/.env.example`) — `DATABASE_URL`, `SESSION_COOKIE_SECRET` (32+ chars, e.g. `openssl rand -base64 32`), `CORS_ORIGIN`, `STORAGE_DRIVER`, etc. Env vars are validated with Zod on boot (`infra/config/env.ts`) and the app exits immediately with a clear error if config is invalid.

Tests are Vitest; no automated test layer touches real infrastructure — repository tests mock `PrismaClient` (`vitest-mock-extended`), service tests mock the repository/gateway, and usecase/route tests mock the service via `buildApp(env, { overrides })`. Docker (`docker-compose.yml`) is for local dev and a manually-validated QA environment, not for the automated suite — per [ARCHITECTURE.md](ARCHITECTURE.md). Tests are written before the implementation at every layer (repository, service, usecase) and a task isn't done until they're actually run and passing — see the `testing` skill for the full red-green workflow.

## Architecture

Every code-shaped pattern below (controller, dto, usecase, service, gateway, repository, enum,
exception-handler, logging, swagger, testing) is documented in detail as its own skill in
`.claude/skills/<pattern>/` — those are the source of truth for how to implement each layer; this
section is only the map.

### Module boundaries (hard rule)

`apps/api/src/modules/{identity,pets,messaging,moderation}` are bounded contexts. **A module only queries its own tables through its own repository.** A service **never** calls another module's service directly — cross-module communication happens exclusively in the usecase layer, which orchestrates the services of the modules involved. A usecase that only orchestrates its own module's service lives inside that module (`modules/<module>/<name>.usecase.ts`); only a usecase that genuinely orchestrates services of **more than one** module lives in `apps/api/src/shared/usecases/<name>.usecase.ts` (e.g. `shared/usecases/send-message.usecase.ts`, crossing `pets` + `messaging`). This is what makes it a *modular* monolith rather than folders-by-feature; don't break this boundary when wiring new features together (e.g. `moderation` removing a listing must go through a usecase that orchestrates `moderation` and `pets`, never a direct call between their services).

Each module is internally layered `route → usecase → service → repository`. Every route calls a usecase — even single-module CRUD, there's no `route → service` shortcut. The service is the only thing that calls its own module's repository and applies business rules; the repository is the only thing that talks to Prisma; the service is also the only layer allowed to call a gateway (`apps/api/src/gateways/`) for external-system integration (see "Gateways" below). DTOs (`<module>.dto.ts`, `z.infer` of the module's Zod schemas) are what every layer — route, usecase, service, repository — actually passes around, never the raw Zod schema or a Prisma-generated type.

`apps/api/src/infra/` is the technical/framework-plumbing layer, not a domain module: `config` (env loading), `errors` (the `AppError` hierarchy — just the error classes), the global exception handler (see below), `db` (Prisma client). The criterion for landing here is "technical, no business meaning" — not how many modules currently use it (see the `infra-placement` skill). `apps/api/src/shared/` is now only for cross-cutting *domain* concepts used by more than one module (e.g. `enums` — module-specific enums live inside their own module instead).

`apps/api/src/gateways/` holds integration with external systems (today: storage/S3 and the SQS registration queue). Not a domain module, and not inside `shared/` — see "Gateways" and "Queues" below.

### Request flow

`src/server.ts` loads env and calls `buildApp(env)` from `src/app.ts`, which wires Fastify plugins (cors, cookie, rate-limit, zod validators/serializers), the global exception handler, `/health`, and registers each module under `/api/<module>`. All four modules are registered today, all following the `<módulo>Plugin` naming decided in the `controller` skill: `identity` (via `identityPlugin`), `pets` (via `petsPlugin`), `moderation` (via `moderationPlugin`), and `messaging` (via `messagingPlugin`).

### Exception handling

Centralize the handling, decentralize the creation: errors are thrown where the business rule lives (in a module), but all of them are caught in one place — the global exception handler (`formatErrorResponse` in `infra/exception-handler.ts`, registered via `app.setErrorHandler(...)`). It works generically off `instanceof AppError` (4xx, business error, carries its own `statusCode`/`code`/`message`/`details`) vs. anything else (500, treated as a bug, no detail leaked) — adding a new error class never requires touching this handler. Always `throw new SomeSpecificError(...)`, never a raw string/object.

Generic, reusable-anywhere errors (`NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`) live in `infra/errors/app-error.ts`. An error tied to one module's business rule gets its own subclass in `modules/<module>/errors.ts` instead of being forced into a generic one.

### Logging

Access log only (method/url/status/duration/request-id), not a business-action audit trail — cross-cutting, lives in `app.ts` via Fastify's built-in pino logger, not per-route/service. Explicit `requestLogSerializers` in `app.ts` pin the `req`/`res` serializers to just those fields so headers (and the session cookie in them) never leak into logs. Correlation is via `genReqId` (reads `x-request-id`, falls back to `randomUUID()`). No request/response body logging yet — would need a redaction allowlist first. See the `logging` skill for the full decision and what's deliberately deferred (body logging, a persisted `AuditLog` table).

### Gateways (external service integration)

A gateway is the repository's counterpart for the outside world: the one place that talks to a given external system, with no business logic in it — just config/credentials and translating between the domain's shape and whatever that external system expects/returns. Only the service layer calls a gateway (never a route, usecase, or repository). Gateways are concrete classes, named `<service>.gateway.service.ts` in `apps/api/src/gateways/`, by default with no interface/swappable-driver layer — except when more than one provider is genuinely real (not hypothetical), in which case each provider gets its own class and a factory function picks between them, still without a formal `interface` (a structural union type is enough). `storage` is that exception today: `LocalStorageGateway` and `S3StorageGateway` (`local-storage.gateway.service.ts`, `s3-storage.gateway.service.ts`), picked by `createStorageGateway` (`storage.gateway.service.ts`) based on `STORAGE_DRIVER`. `PetsRegistrationQueueGateway` (`pets-registration-queue.gateway.service.ts`) is the default case instead: LocalStack (dev) and real SQS (prod) are the same protocol/SDK behind a different endpoint, not two genuinely different providers, so it stays a single class (endpoint from `SQS_ENDPOINT`, unset in prod).

### Queues (SQS)

The gateway is still the only thing that talks to SQS — neither the producer nor the consumer side imports `@aws-sdk/client-sqs` or `sqs-consumer` directly; the gateway wraps `sqs-consumer` internally and exposes only `enqueue(body)`, `startConsuming(handleMessage, onError)`, and `stopConsuming()`. There's no separate "enqueue service" role: the owning module's own service decides when/what to enqueue and calls `gateway.enqueue(...)` (e.g. `PetsService.submitListingForRegistration`). The consumer lives inside its owning module, not in `infra/` (its payload parsing/validation carries business meaning — same "business meaning → module" criterion as the `infra-placement` skill), named `<module>/<operation>.consumer.ts` exporting `start<Operation>Consumer` (e.g. `modules/pets/pets-registration.consumer.ts` → `startPetsRegistrationConsumer`). A malformed message, a schema-validation failure, or a persistence failure all `throw` inside `handleMessage` so the message is left on the queue for redelivery/DLQ rather than deleted. In dev, LocalStack (`docker-compose.yml`) simulates SQS and self-provisions the queues via an init hook (`infra/localstack/init/`). See the `queue` skill for the full convention.

### Enums

Finite-value fields (status, role, type) are always an enum, with full-word values (`ACTIVE`, not `A` or `1`), never a raw string/number compared inline. If the value is a Prisma column, it's declared once in `schema.prisma` and reused everywhere else via `z.nativeEnum(...)`, wrapped in a single `<name>.enum.ts` file per enum (e.g. `shared/enums/role.enum.ts`) so the `@prisma/client` import stays contained to that one file — an explicit, scoped exception to "only the repository talks to Prisma." Non-persisted enums are declared directly with `z.enum([...] as const)`. Enums used by more than one module live in `shared/enums/`; module-specific ones live inside that module.

### API documentation (Swagger/OpenAPI)

`@fastify/swagger` + `@fastify/swagger-ui`, registered in `app.ts` only outside production, using `jsonSchemaTransform` from `fastify-type-provider-zod` to turn the routes' existing Zod schemas into the OpenAPI spec — no schema duplicated just for docs. UI at `/docs`, raw spec at `/docs/json`. A route's `summary`/`description`/`tags` live inline in that route's `schema` object (not in `schemas.ts`); field-level description uses Zod's `.describe()`. No per-field example values yet (see the `swagger` skill for why and what would change that).

### Auth model (identity module)

Session-based, not JWT: httpOnly cookie (`@fastify/cookie`) + a `sessions` table in Postgres, password hashing via `argon2`. Authorization is a simple `role` enum (`USER`/`ADMIN`) on `User`, checked via the `requireAuth`/`requireRole('ADMIN')` hooks (`infra/auth.ts`) — no general RBAC. That plugin lives in `infra/`, not `modules/identity/`, even though it queries `IdentityRepository` for its session lookup: it's cross-cutting request middleware needed by every module with authenticated routes, not identity-exclusive business logic (see the `auth-middleware` skill). CORS is configured with `credentials: true` and an explicit origin (never `*`), which is required for cookie-based auth to work cross-origin.

### Data model conventions

- Soft delete via `deletedAt` (not hard delete) on `User` and `PetListing`, so moderation/reports can still reference removed listings.
- Geolocation is plain `lat`/`lng` columns with a distance formula in raw SQL (Prisma `$queryRaw`) — PostGIS was deliberately skipped for simplicity.
- Pagination is offset/limit, not cursor-based.
- Prisma schema (`apps/api/prisma/schema.prisma`) is organized in comment-delimited sections per module phase; add new models under the relevant phase section, matching the module that owns them.
