# Auditoria de segurança — fluxo de autenticação (`GET /api/identity/me`)

Auditoria pontual, feita por um subagente especialista em segurança de aplicações, sobre o fluxo `cookie → sessão → usuário → resposta` usado por `GET /api/identity/me` e pelo middleware `requireAuth`/`requireRole` do qual ele depende. Escopo pedido: SQL injection e forjar/escalar role. Auditoria somente-leitura, nenhum código foi alterado.

**Repositório**: Lost Pets v2 — `apps/api`. Analisado sobre `main` (`22b6822`) e o branch `backend/feat/identity-me` (`814f15b`), onde a rota `/me` existia no momento da auditoria.

**Data**: 2026-07-04.

## 1. Veredito objetivo

- **SQL injection: não é possível.** Nenhuma ocorrência de `$queryRaw`, `$executeRaw`, `Prisma.sql` ou `Prisma.raw` em `apps/api/src`. Toda a cadeia passa pelo Prisma Client query builder parametrizado — ex. `identity.repository.ts:50-54` (`findValidById`) usa `prisma.session.findFirst({ where: { id: sessionId, ... } })`, sem concatenação de string SQL em ponto nenhum do fluxo.

- **Forjar/escalar role: não é possível** no fluxo atual.
  - `infra/auth.ts:52-58` — `requireAuth` sempre revalida a sessão no banco a cada request (`repository.findValidById`), e `request.user = session.user` vem do `include: { user: true }` do Prisma, direto da coluna `role` persistida (`schema.prisma:24`, `role Role @default(USER)`).
  - O cookie de sessão é um **id opaco** (`session.id`, UUID), não um token que embute claims — não há JWT nem decodificação de payload no cliente.
  - `registerUserBodySchema` (`identity.schema.ts:21-25`) aceita só `email`, `password`, `name` — `role` não existe nesse schema; é sempre `@default(USER)`. Grep amplo por `role` em `apps/api/src` não encontrou nenhum ponto de mass assignment.
  - `meResponseSchema = sessionWithUserSchema.shape.user` (`identity.schema.ts:96`) só espelha `request.user`, sem nova query nem input externo.

## 2. Achados

Nenhum achado de severidade crítica/alta/média para SQL injection ou forjar role.

- **Baixo — `trustProxy` não configurado (`app.ts:41-53`)**: o rate limit usa `request.ip`. Sem `trustProxy: true`, o Fastify ignora `X-Forwarded-For` e usa o IP da conexão TCP direta — hoje não é explorável. Vira relevante só se a API for colocada atrás de um reverse proxy/load balancer sem configurar `trustProxy` com lista explícita de IPs confiáveis. Recomendação: ao fazer esse deploy, configurar `trustProxy` explicitamente, nunca `true` genérico sem validar a cadeia de proxies.

## 3. Pontos fortes observados

- **Sessão opaca revalidada no banco a cada request** (`auth.ts:55-58`), incluindo checagem de expiração (`expiresAt: { gt: new Date() }`) — elimina de raiz ataques de "claim de role forjada em JWT", porque não existe JWT no fluxo.
- **Cookie assinado corretamente verificado antes de uso** (`auth.ts:52-53`): `unsigned.valid` é checado antes de usar `unsigned.value`. `signed: true`, `httpOnly: true`, `sameSite: 'lax'`, `secure: isProduction` (`identity.routes.ts:78-84`).
- **`SESSION_COOKIE_SECRET` validado com `z.string().min(32)`** (`env.ts:8`), boot falha rápido se ausente/fraco.
- **Query builder Prisma em 100% dos acessos a dado** — nenhum SQL cru em todo `apps/api/src`.
- **`role` nunca aceito como input do cliente** — enum fechado (`USER | ADMIN`), setado só via `@default(USER)` ou server-side/seed.
- **Login não vaza qual credencial falhou** (`identity.service.ts:29-34`): email inexistente e senha errada retornam o mesmo `UnauthorizedError('Credenciais inválidas')` — mitiga user enumeration por conteúdo da resposta (mas não por timing, ver seção 4).
- **Rate limiting ativo e mais restritivo em rotas sensíveis**: `/register` (5/min) e `/login` (10/min) além do limite global.
- **Senha com hashing forte**: argon2 (`password.ts`), não MD5/SHA simples nem texto plano.
- **Separação DTO clara**: `UserWithPasswordDto` (com `passwordHash`) nunca é o shape retornado por rota nenhuma; `AuthenticatedUserDto`/`meResponseSchema` são projeções seguras via Zod.

## 4. Sugestões fora do escopo desta auditoria (decisões de arquitetura, não bugs — para analisar com calma)

1. **Timing attack em `/login`**: `verifyPassword` (argon2, custo de CPU alto) só roda quando o email existe — a diferença de latência entre "email existe, senha errada" e "email não existe" pode vazar se uma conta existe, mesmo com mensagem de erro idêntica. Mitigação usual: rodar um hash "dummy" de custo equivalente quando o usuário não é encontrado. Trade-off: custo de CPU extra em toda tentativa de login.
2. **Revogação em massa de sessões**: `deleteById` só derruba uma sessão por vez. Não há "logout de todos os dispositivos" nem revogação em massa ao trocar de senha — relevante quando existir fluxo de troca/reset de senha.
3. **Rotação de `SESSION_COOKIE_SECRET`**: sem suporte a múltiplos secrets simultâneos (`@fastify/cookie` aceita `secret: [novo, antigo]`) — hoje trocar o secret invalida todos os cookies em circulação.
4. **`trustProxy` / IP real atrás de proxy reverso**: decisão a tomar conscientemente no momento do deploy (ver achado da seção 2).
