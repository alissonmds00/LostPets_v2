---
name: controller
description: >
  Documenta a convenção já decidida neste projeto para a camada de controller/route handler
  (Fastify). Use esta skill sempre que o usuário pedir para criar, estruturar ou revisar uma rota,
  controller, handler HTTP ou endpoint (ex: "cria uma rota pra X", "monta o handler de Y", "cria
  uma controller pra Z") — mesmo que ele use terminologia de outro framework (ex: "controller" num
  projeto Fastify que não tem essa camada). Aplique a convenção documentada abaixo antes de
  escrever qualquer código; se a situação não estiver coberta por ela, não decida sozinho — acione
  a skill pattern-advisor para resolver a lacuna com o usuário.
---

# Controller / route handler

## Decisão (registrada em 2026-07-03)

- Este projeto não tem uma camada de controller separada — a rota Fastify (`route → usecase →
  service → repository`, ver [ARCHITECTURE.md](../../../ARCHITECTURE.md)) já cumpre esse papel.
  Não crie um arquivo `controller.ts` adicional entre a rota e o usecase.
- Os schemas Zod de request/response de cada rota ficam em um arquivo `schemas.ts` por módulo
  (`apps/api/src/modules/<módulo>/schemas.ts`), não inline no arquivo de rota.
- Response schema é obrigatório em toda rota desde já (serialização mais rápida via
  fast-json-stringify e evita vazar campo sensível por acidente) — não pule esse schema mesmo em
  rotas simples/CRUD.
- A rota **nunca** importa ou chama um service ou repository diretamente — só o usecase
  correspondente (ver skill `usecase`). Isso vale mesmo para operações simples de um módulo só; não
  existe atalho `route → service`.

**Alternativas consideradas:** schemas inline no arquivo da rota (rejeitado — mantém tudo junto,
mas o arquivo cresce demais conforme a rota fica complexa); response schema opcional/gradual
(rejeitado — risco real de esquecer o schema numa rota que devolve dado sensível mais adiante).

**Verificado com base em:** o projeto de referência
[node-fastify-architecture](https://github.com/sujeet-agrahari/node-fastify-architecture) separa
schema e rota por módulo do mesmo jeito (`{module}.schema.js` vs `{module}.routes.js`); a própria
lib `fastify-type-provider-zod` documenta oficialmente o padrão de schema definido como constante
importada e só referenciada na chave `schema:` da rota — a linha de referência no arquivo de rota
é exigência da assinatura do Fastify (`schema` e `handler` no mesmo objeto de opções), não uma
camada de lógica adicional.

## Como aplicar

Ao criar uma rota nova:
1. Adicione ou atualize os schemas de request/response em `schemas.ts` do módulo correspondente.
2. A rota importa esses schemas e os registra no Fastify via `fastify-type-provider-zod`, chamando
   o usecase correspondente dentro do handler (ver skill `usecase`) — nunca um service ou
   repository diretamente.
3. Erros lançados seguem `AppError` (`infra/errors`), nunca um formato novo.
4. `summary`/`description`/`tags` da rota (documentação no Swagger) vão inline no mesmo `schema:
   {...}` da rota, ao lado de `body`/`response` — ver skill `swagger`.

## Se algo não estiver coberto aqui

Isso indica uma decisão nova, não uma extensão óbvia desta convenção (ex: onde resolver paginação,
como nomear uma rota aninhada, etc.). Não resolva sozinho — acione a skill `pattern-advisor` para
decidir isso com o usuário, e depois atualize esta skill com o resultado.
