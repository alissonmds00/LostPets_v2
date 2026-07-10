---
name: auth-middleware
description: >
  Documenta a convenção já decidida neste projeto para middleware de autenticação/autorização
  (hooks tipo requireAuth/requireRole). Use esta skill sempre que o usuário pedir para criar,
  estruturar ou revisar autenticação/autorização de rota — ex: "protege essa rota", "só admin pode
  acessar isso", "cria o middleware de auth", "como eu bloqueio quem não tá logado". Aplique a
  convenção documentada abaixo antes de escrever qualquer código; se a situação não estiver
  coberta por ela, não decida sozinho — acione a skill pattern-advisor para resolver a lacuna com
  o usuário.
---

# Auth middleware (requireAuth / requireRole)

## Decisão (registrada em 2026-07-04)

- Middleware de autenticação/autorização **cross-cutting** (usado por rotas de mais de um módulo)
  vive em `infra/` (`apps/api/src/infra/auth.ts`), não dentro do módulo `identity` — mesmo que ele
  dependa do `IdentityRepository` de `identity` para buscar a sessão. O critério é **quem usa**,
  não **quem fornece o dado**: `requireAuth`/`requireRole` protegem rotas de `pets`, `messaging` e
  `moderation` também, não só de `identity`, então não são lógica de negócio exclusiva de um
  módulo — são infraestrutura de request compartilhada, do mesmo jeito que `infra/config` e
  `infra/errors` já são.
- `infra/` pode depender de um módulo de domínio (`identity`) pra isso — importar
  `IdentityRepository` dali é permitido. A regra dura de módulo (`ARCHITECTURE.md`) proíbe um
  **módulo de domínio** acessar a tabela de outro módulo direto; não proíbe infraestrutura
  compartilhada de consumir o repositório público de um módulo específico.
- Implementado como plugin do Fastify, registrado na raiz (`app.ts`), **não** aninhado dentro do
  `app.register(identityPlugin, ...)` — encapsulamento de plugin do Fastify faria os decorators
  (`app.decorate('requireAuth', ...)`) ficarem visíveis só dentro do próprio `identityPlugin`,
  invisíveis pra `pets`/`messaging`/`moderation` registrados como irmãos.
- Envolvido com `fastify-plugin` (`fp`) — isso reforça o registro na raiz mesmo que o arquivo
  venha a ser importado/registrado de outro lugar no futuro: `fp` tira o plugin do encapsulamento
  padrão do Fastify, então seus decorators continuam anexados no escopo pai em vez de ficarem
  presos num contexto filho.
- `requireAuth`: lê o cookie de sessão (`SESSION_COOKIE_NAME`), busca a `Session` válida via
  `IdentityRepository.findValidById`, anexa `request.user` (só os campos seguros — nunca
  `passwordHash`); lança `UnauthorizedError` se cookie ausente/inválido/sessão inexistente ou
  expirada. `requireRole(role)` chama `requireAuth` primeiro e lança `ForbiddenError` se o papel
  não bater.

**Alternativas consideradas:** manter `requireAuth`/`requireRole` dentro de
`modules/identity/auth.ts` (rejeitado — funcionava tecnicamente porque o plugin era registrado na
raiz de qualquer forma, mas a localização do arquivo sugeria "pertence à identity", quando na
verdade é consumido por todos os módulos; `ARCHITECTURE.md` já separa módulo de domínio de
infraestrutura transversal, e esse middleware se encaixa melhor como a segunda coisa).

## Como aplicar

Ao proteger uma rota nova (de qualquer módulo):
1. Não crie um novo hook de auth — use os decorators já existentes: `app.requireAuth` (ou
   `preHandler: app.requireAuth`) pra exigir só login, `app.requireRole('ADMIN')` (ou o papel que
   for) pra exigir também um papel específico.
2. Se a rota precisa do usuário logado, leia `request.user` (tipado via `AuthenticatedUserDto`) —
   ele já está anexado depois que `requireAuth` roda.
3. Erros de acesso já saem como `UnauthorizedError`/`ForbiddenError` (`infra/errors`) — não trate
   esse caso manualmente na rota.
4. Se o middleware precisar de um dado novo (ex: verificar algo específico de `pets`), isso não
   entra aqui — ou vira parâmetro do próprio hook (se for genérico o bastante pra qualquer módulo),
   ou é uma decisão nova pra discutir via `pattern-advisor`.

## Se algo não estiver coberto aqui

Isso indica uma decisão nova (ex: um segundo tipo de auth — API key, JWT pra integração externa —
ou um middleware de autorização mais granular que papel simples, tipo dono do recurso). Não
resolva sozinho — acione a skill `pattern-advisor` para decidir isso com o usuário, e depois
atualize esta skill com o resultado.
