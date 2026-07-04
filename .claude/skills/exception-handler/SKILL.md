---
name: exception-handler
description: >
  Documenta a convenção já decidida neste projeto para tratamento de exceções — o exception
  handler global do Fastify e onde cada classe de erro deve morar. Use esta skill sempre que o
  usuário pedir para criar um erro novo, tratar uma exceção de forma customizada, decidir que
  status code uma falha deve retornar, ou perguntar "que erro eu lanço aqui" / "como isso vira uma
  resposta HTTP". Aplique a convenção documentada abaixo antes de escrever qualquer código; se a
  situação não estiver coberta por ela, não decida sozinho — acione a skill pattern-advisor para
  resolver a lacuna com o usuário.
---

# Exception handler

## Decisão (registrada em 2026-07-03)

Três princípios, nessa ordem de importância:

1. **Centralize o tratamento, descentralize a criação.** O erro é criado onde a regra de negócio
   acontece — no módulo. Mas todo erro é capturado num único lugar: o exception handler global
   ([`formatErrorResponse`](../../../apps/api/src/shared/infra/exception-handler.ts), registrado
   via `app.setErrorHandler(...)` em [`app.ts`](../../../apps/api/src/app.ts)). Esse handler **já
   existe e não muda** — nenhum erro novo exige tocar nele.
2. **Herança com `instanceof`.** Toda classe de erro estende `AppError`. É isso que permite o
   handler global filtrar, com uma checagem só, o que é erro de negócio esperado (`instanceof
   AppError`, 4xx, com `statusCode`/`code`/`message`/`details` já embutidos na instância) do que é
   bug/erro de servidor (qualquer outra coisa, 500 genérico, sem detalhe vazado).
3. **Nunca lance string ou objeto puro — sempre `throw new MeuErroEspecifico()`.** O TypeScript
   tipa e narrowa melhor assim, e o stack trace fica correto (apontando pra onde o erro realmente
   aconteceu, não pra dentro do handler genérico).

**Onde cada coisa mora dentro de `shared/`** (decentralização da criação, aplicada):
- `shared/errors/` guarda só as **classes** de erro gerais da aplicação (`AppError` e os genéricos
  `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`) — nenhuma lógica de
  Fastify aqui, só as classes em si.
- `shared/infra/` guarda a camada de infraestrutura — hoje, o exception handler global
  (`exception-handler.ts`, a função `formatErrorResponse` e sua ligação com o Fastify). É uma
  separação consciente: a classe de erro é conceito de domínio/aplicação, o handler que a traduz
  em resposta HTTP é infraestrutura.
- Erro de regra de negócio específica de um módulo (ex: "não pode resolver um anúncio já
  cancelado") vira uma subclasse nova em `modules/<módulo>/errors.ts`, estendendo `AppError` ou o
  genérico mais próximo (ex: `class ListingAlreadyResolvedError extends ConflictError`).

**Alternativas consideradas:** centralizar todo erro (inclusive os específicos de módulo) em
`shared/errors` — rejeitado, incharia um arquivo compartilhado com conceitos que só um módulo
entende; um exception handler por módulo em vez de um só global — rejeitado, o handler atual já é
genérico via `instanceof AppError`, múltiplos handlers não trariam benefício real.

## Como aplicar

Ao precisar de um erro novo:
1. É específico de uma regra de negócio de um módulo? `throw new` de uma subclasse em
   `modules/<módulo>/errors.ts`. É genuinamente reaproveitável em qualquer módulo? Adicione em
   `shared/errors/app-error.ts`.
2. Sempre `throw new XError(...)` no service ou usecase onde a regra é violada — nunca `throw`
   de string/objeto solto, nunca montar a resposta HTTP (`reply.status(...).send(...)`) na mão. O
   exception handler global em `shared/infra/exception-handler.ts` cuida disso sozinho.

## Se algo não estiver coberto aqui

Isso indica uma decisão nova (ex: um erro que precisa de um formato de resposta diferente do
padrão `{ error: { code, message, details? } }`, ou um caso que genuinamente pede um handler
separado do global). Não resolva sozinho — acione a skill `pattern-advisor` para decidir isso com
o usuário, e depois atualize esta skill com o resultado.
