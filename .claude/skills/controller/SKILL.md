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
- Os schemas Zod de request/response de cada rota ficam em um arquivo `<módulo>.schema.ts` por
  módulo (`apps/api/src/modules/<módulo>/<módulo>.schema.ts`), não inline no arquivo de rota —
  nome com prefixo do domínio, consistente com `<módulo>.dto.ts`/`<módulo>.repository.ts`.
- Response schema é obrigatório em toda rota desde já (serialização mais rápida via
  fast-json-stringify e evita vazar campo sensível por acidente) — não pule esse schema mesmo em
  rotas simples/CRUD.
- A rota **nunca** importa ou chama um service ou repository diretamente — só o usecase
  correspondente (ver skill `usecase`). Isso vale mesmo para operações simples de um módulo só; não
  existe atalho `route → service`.
- Arquivo de rota: `<módulo>.routes.ts`, dentro de `apps/api/src/modules/<módulo>/` — **nunca** uma
  pasta `routes/` centralizada na raiz de `src/`. Fastify tem duas convenções comuns pra isso: (a)
  uma pasta `routes/` na raiz com `@fastify/autoload`, comum em APIs simples e flat; (b) cada
  módulo coloca sua própria rota junto do seu service/repository, preservando o encapsulamento de
  plugin do Fastify como o mecanismo de fronteira de módulo — é essa a razão pela qual este projeto
  escolheu Fastify (ver `ARCHITECTURE.md`), então centralizar rotas na raiz quebraria exatamente o
  que o encapsulamento de plugin foi escolhido pra garantir.
- A função exportada por `<módulo>.routes.ts` (o plugin Fastify registrado via `app.register(...)`
  em `app.ts`) se chama `<módulo>Plugin` — ex: `identityPlugin` em `identity.routes.ts`,
  `petsPlugin` em `pets.routes.ts`. "Plugin" é o termo que a própria documentação do Fastify usa
  pra essa forma (`async (app, opts) => Promise<void>` registrado via `.register()`); "module"
  fica reservado pro bounded context/pasta (`modules/identity/`, `modules/pets/` como diretórios),
  não pro identificador da função. Não use `<módulo>Module` como nome de função — isso mistura os
  dois conceitos e foi renomeado justamente por causa dessa confusão.

**Alternativas consideradas:** schemas inline no arquivo da rota (rejeitado — mantém tudo junto,
mas o arquivo cresce demais conforme a rota fica complexa); response schema opcional/gradual
(rejeitado — risco real de esquecer o schema numa rota que devolve dado sensível mais adiante).

**Verificado com base em:** o projeto de referência
[node-fastify-architecture](https://github.com/sujeet-agrahari/node-fastify-architecture) separa
schema e rota por módulo do mesmo jeito (`{module}.schema.js` vs `{module}.routes.js`); a própria
lib `fastify-type-provider-zod` documenta oficialmente o padrão de schema definido como constante
importada e só referenciada na chave `schema:` da rota — a linha de referência no arquivo de rota
é exigência da assinatura do Fastify (`schema` e `handler` no mesmo objeto de opções), não uma
camada de lógica adicional. A convenção de rota colocada dentro do próprio módulo (em vez de uma
pasta `routes/` central) segue o repositório de referência de Matteo Collina (mantenedor do
Fastify), [modular_monolith](https://github.com/mcollina/modular_monolith) — "Building a Modular
Monolith with Fastify" — que usa exatamente o encapsulamento de plugin do Fastify como fronteira de
módulo, o mesmo raciocínio já registrado em `ARCHITECTURE.md` pra por que este projeto escolheu
Fastify.

## Como aplicar

Ao criar uma rota nova:
1. Adicione ou atualize os schemas de request/response em `<módulo>.schema.ts` do módulo
   correspondente.
2. A rota (`<módulo>.routes.ts`, dentro de `modules/<módulo>/`) importa esses schemas e os registra
   no Fastify via `fastify-type-provider-zod`, chamando o usecase correspondente dentro do handler
   (ver skill `usecase`) — nunca um service ou repository diretamente.
3. Erros lançados seguem `AppError` (`infra/errors`), nunca um formato novo.
4. `summary`/`description`/`tags` da rota (documentação no Swagger) vão inline no mesmo `schema:
   {...}` da rota, ao lado de `body`/`response` — ver skill `swagger`.

## Se algo não estiver coberto aqui

Isso indica uma decisão nova, não uma extensão óbvia desta convenção (ex: onde resolver paginação,
como nomear uma rota aninhada, etc.). Não resolva sozinho — acione a skill `pattern-advisor` para
decidir isso com o usuário, e depois atualize esta skill com o resultado.
