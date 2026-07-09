---
name: queue
description: >
  Documenta a convenção já decidida neste projeto para produtor/consumidor de fila (SQS). Use esta
  skill sempre que o usuário pedir para enfileirar algo, processar mensagens de uma fila, ou criar
  um fluxo assíncrono via SQS — ex: "cria a fila de X", "enfileira Y antes de persistir", "processa
  as mensagens da fila Z", "cria o consumidor/worker de W". Aplique a convenção documentada abaixo
  antes de escrever qualquer código; se a situação não estiver coberta por ela, não decida sozinho
  — acione a skill pattern-advisor para resolver a lacuna com o usuário.
---

# Queue (produtor/consumidor SQS)

## Decisão (registrada em 2026-07-09, reabre a decisão original de 2026-07-04)

- **O gateway continua sendo o único ponto que fala com SQS** — nem o produtor nem o consumidor
  importam `@aws-sdk/client-sqs` ou `sqs-consumer` diretamente. Isso segue a regra geral da skill
  `gateway` (um objeto por sistema externo, tradução sem lógica de negócio) sem abrir exceção pra
  fila.
- **Produtor:** não existe um "enqueue service" como papel arquitetural separado. A regra de
  negócio de quando/o que enfileirar continua dentro do **service único do módulo** (skill
  `service` — "um service coeso por módulo"), que chama `gateway.enqueue(body)`. Ex:
  `PetsService.submitListingForRegistration` valida/processa e chama
  `queueGateway.enqueue(JSON.stringify(dto))` — nada muda aqui.
- **Consumidor:** o gateway usa a lib `sqs-consumer` **por dentro**, expondo só dois métodos
  públicos — `startConsuming(handleMessage, onError)` e `stopConsuming()` — nunca o `SQSClient` cru
  nem uma instância de `Consumer` da lib. `handleMessage: (body: string) => Promise<void>` recebe
  só o corpo bruto da mensagem (string); resolver deleta a mensagem (comportamento default do
  `sqs-consumer`), lançar erro deixa a mensagem na fila pra redelivery. `onError` cobre falha do
  polling em si (ex: SQS fora do ar), não falha de `handleMessage` (essa é tratada dentro do próprio
  handler, com log específico por tipo de falha antes de relançar).
- **Local do arquivo consumidor: dentro do módulo dono, não em `infra/` nem numa pasta técnica
  compartilhada.** O parsing/validação de payload (schema Zod específico daquele tipo de mensagem)
  carrega significado de negócio do módulo — pelo critério já fixado na skill `infra-placement`
  ("carrega significado de negócio → fica dentro do módulo", não "quantos módulos usam"). Só a
  mecânica genérica de SQS (o `sqs-consumer` em si) é plumbing técnico, e essa parte já está isolada
  dentro do gateway — não sobra nada genérico o suficiente pra justificar uma pasta `infra/queue/`
  ou uma pasta-irmã `pollers/` fora dos módulos.
- **Convenção de nome:** `<módulo>/<operação>.consumer.ts`, função `start<Operação>Consumer`, ex:
  `modules/pets/pets-registration.consumer.ts` → `startPetsRegistrationConsumer`. Espelha a mesma
  ideia de granularidade por operação já usada em `usecase` (`<operação>.usecase.ts`).
- **Semântica de erro preservada do desenho anterior (poller manual):** mensagem malformada (JSON
  inválido), mensagem que falha validação de schema, e falha ao persistir (`registerListing`
  lançando) — as três continuam **não sendo deletadas** (ficam na fila até redelivery/DLQ via
  redrive policy), agora expressas como `throw` dentro do `handleMessage` em vez de um `return` sem
  chamar `deleteMessage`.

**Alternativas consideradas:**
- Produtor e consumidor falando direto com o SDK/lib (`services/enqueue-<algo>.service.ts` +
  `infra/queue/<algo>.consumer.ts`, sketch original proposto) — rejeitada por duplicar o client SQS
  em dois arquivos e abrir uma exceção pontual à skill `gateway` só pra filas.
- Consumidor expor o `SQSClient` cru do gateway pro arquivo consumidor montar o `Consumer.create()`
  do `sqs-consumer` ele mesmo — rejeitada porque fura a encapsulação do gateway sem necessidade: o
  gateway consegue envolver `sqs-consumer` por dentro e expor só `startConsuming`/`stopConsuming`.
- Consumidor genérico em `infra/queue/` — rejeitada porque o parsing/validação específico de cada
  fila é lógica de domínio do módulo dono, não plumbing técnico (ver critério da skill
  `infra-placement`); só ficaria em `infra/` uma fila cujo consumidor não carregasse nenhum
  conceito de negócio, o que não é o caso hoje.
- Manter o loop artesanal (`while` + `receiveMessages`/`deleteMessage` expostos pelo gateway) —
  funcionava, mas a lib `sqs-consumer` remove o boilerplate de polling/delete/erro sem custo de
  encapsulação (ver "Como aplicar" abaixo).

## Como aplicar

Ao introduzir uma fila SQS nova:
1. Gateway em `gateways/<fila>.gateway.service.ts` (skill `gateway`): método `enqueue(body: string)`
   pro lado produtor, e `startConsuming(handleMessage, onError)` / `stopConsuming()` pro lado
   consumidor — este último usando `sqs-consumer` (`Consumer.create({ queueUrl, sqs: this.client,
   handleMessage })`) internamente, nunca expondo o client nem a instância de `Consumer`.
2. Produtor: o service do módulo dono chama `gateway.enqueue(...)` depois de validar/processar —
   sem criar um service novo só pra isso.
3. Consumidor: `modules/<módulo>/<operação>.consumer.ts`, função `start<Operação>Consumer(gateway,
   <module>Service, logger)` que chama `gateway.startConsuming(handler, onError)`. O `handler` faz
   parse do JSON, valida contra o schema Zod da operação, chama o método de persistência do service
   do módulo, e relança qualquer erro dessas três etapas (com log específico antes) pra deixar a
   mensagem na fila.
4. Wiring: instanciado em `server.ts` depois do `app.listen()` (mesmo padrão do poller original),
   passando uma instância própria do gateway e reusando o service já decorado em `app.<módulo>Service`.
5. Teste (skill `testing`): gateway mocka `@aws-sdk/client-sqs` e `sqs-consumer` (captura o
   `handleMessage` passado a `Consumer.create` e invoca diretamente); consumidor mocka o gateway
   (captura o `handleMessage` passado a `startConsuming` e invoca diretamente) — nenhum toca SQS
   real, LocalStack incluso.

## Se algo não estiver coberto aqui

Isso indica uma decisão nova (ex: uma fila que precisa de batch processing real, uma fila cujo
consumidor não carrega nenhuma lógica de domínio, ou a introdução de um worker separado
`apps/worker`). Não resolva sozinho — acione a skill `pattern-advisor` para decidir isso com o
usuário, e depois atualize esta skill com o resultado.
