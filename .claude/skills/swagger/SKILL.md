---
name: swagger
description: >
  Documenta a convenção já decidida neste projeto para documentação de API via Swagger/OpenAPI.
  Use esta skill sempre que o usuário pedir para documentar um endpoint, adicionar
  summary/description/tags a uma rota, expor a API no Swagger UI, ou pedir pra "poder testar os
  endpoints" pelo navegador. Aplique a convenção documentada abaixo antes de escrever qualquer
  código; se a situação não estiver coberta por ela, não decida sozinho — acione a skill
  pattern-advisor para resolver a lacuna com o usuário.
---

# Swagger / OpenAPI

## Decisão (registrada em 2026-07-03)

- **`@fastify/swagger` + `@fastify/swagger-ui`**, com `transform: jsonSchemaTransform` importado de
  `fastify-type-provider-zod` (já instalado e já usado no projeto pra validação/serialização) — é
  esse transform que converte os Zod schemas das rotas em OpenAPI automaticamente, sem duplicar
  schema nenhum só pra documentação.
- Registrado em [`app.ts`](../../../apps/api/src/app.ts) **só fora de produção**
  (`env.NODE_ENV !== 'production'`) — mesmo padrão condicional que o logger já usa. Produção não
  expõe o shape completo da API (rotas, schemas) publicamente.
- Swagger UI fica em `/docs` (JSON puro da spec em `/docs/json`).
- **`summary`, `description` e `tags` de cada rota ficam inline no `schema: {...}` do próprio
  arquivo de rota** — ao lado de onde `body`/`response` já são referenciados — e não dentro de
  `schemas.ts`. Só o Zod schema de request/response continua em `schemas.ts` (convenção já fixada
  na skill `controller`); metadado de documentação da rota em si não é um Zod schema.
- Descrição de campo individual (ex: o que é o campo `email` do body) usa `.describe('...')` direto
  no Zod schema em `schemas.ts` — já funciona com a versão instalada
  (`fastify-type-provider-zod@4.0.2` + `zod@3`), zero mudança de dependência.
- **Sem exemplo literal de valor por campo por enquanto** (ex: não declarar que `email` vale
  `"ana@example.com"`) — só `.describe()` com texto. O Swagger UI ainda gera um valor de exemplo
  genérico por tipo (`"string"`, `0`) no "Try it out", o que já é suficiente pra testar os
  endpoints manualmente, que era o pedido original.

**Alternativas consideradas (rejeitadas por ora):**
- Migrar `zod` 3→4 + atualizar `fastify-type-provider-zod` pra uma major mais recente, pra usar
  `.meta({ example })` nativo — é o caminho oficial da própria lib pra exemplo real por campo, mas
  é um upgrade de dependência que toca todo schema já escrito no projeto, não algo isolado à parte
  de docs. Fica pra quando/se a falta de exemplo literal virar um problema real.
- Trocar `fastify-type-provider-zod` por `fastify-zod-openapi`/`zod-openapi`, que dá
  `.openapi({ example })` continuando no Zod 3 — mas essa lib está conectada em
  validação/serialização/type-provider no app inteiro (`ZodTypeProvider`, `validatorCompiler`,
  `serializerCompiler`), trocar ela é uma mudança bem maior que "adicionar Swagger".

Se no futuro isso virar uma necessidade real (não só "seria legal ter"), reabra com a skill
`pattern-advisor` — é uma decisão nova, não uma extensão óbvia desta.

**Verificado com base em:** o próprio README de `fastify-type-provider-zod` (instalado, v4.0.2)
documenta `jsonSchemaTransform` + `.describe()` como o caminho de integração com `@fastify/swagger`
para essa combinação de versões; o pacote não suporta `.meta()`/`example` nativo nessa major porque
isso depende de recursos do Zod 4 (`z.globalRegistry`), que o projeto não usa hoje (`zod@^3.23.8`
instalado).

## Como aplicar

Ao criar ou revisar uma rota:
1. Body/response continuam sendo os Zod schemas de `schemas.ts` (skill `controller`/`dto`), com
   `.describe('...')` em cada campo que precisa de explicação além do nome.
2. No arquivo da rota, adicione `summary`, `description` e `tags` dentro do mesmo objeto `schema`
   que já referencia `body`/`response`:
   ```ts
   app.get('/pets/:id', {
     schema: {
       summary: 'Busca um anúncio de pet pelo id',
       description: 'Retorna 404 se o anúncio não existir ou tiver sido removido (soft delete).',
       tags: ['pets'],
       params: getPetParamsSchema,
       response: { 200: petResponseSchema },
     },
   }, handler);
   ```
3. `tags` agrupa rotas do mesmo módulo no Swagger UI — use o nome do módulo (`'pets'`,
   `'identity'`, etc.).
4. Não adicione `example`/`examples` a campo nenhum — não é a convenção decidida agora (ver
   "Alternativas consideradas" acima).

## Rotas multipart (sem `schema.body`)

Uma rota que aceita `multipart/form-data` (ex: `POST /api/pets`, upload de foto) **não** declara
`schema.body` — Fastify não valida multipart contra um Zod schema do mesmo jeito que valida um body
JSON, então declarar `body` ali sugeriria falsamente que o validador do Fastify está checando
aquilo, quando a validação real é manual dentro do handler (`algumSchema.parse(rawBody)`, montado a
partir das partes lidas de `request.parts()`). Nesse caso, os campos de texto e de arquivo esperados
são documentados em prosa na própria `description` da rota, listando nome/tipo/obrigatoriedade de
cada campo de texto (consulte o schema `.omit`/`.extend` correspondente em `<módulo>.schema.ts` para
descrevê-los com precisão) e mencionando que uma ou mais partes de arquivo são esperadas. `consumes:
['multipart/form-data']` continua declarado normalmente, e `response` segue obrigatório como em
qualquer rota.

## Se algo não estiver coberto aqui

Isso indica uma decisão nova (ex: exemplo literal por campo virou necessário de verdade, autenticar
o acesso ao `/docs`, publicar a spec fora do projeto). Não resolva sozinho — acione a skill
`pattern-advisor` para decidir isso com o usuário, e depois atualize esta skill com o resultado.
