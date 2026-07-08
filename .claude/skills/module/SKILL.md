---
name: module
description: >
  Documenta a convenção já decidida neste projeto para o arquivo `.module.ts` de cada módulo —
  o ponto que centraliza a wiring de DI (instanciar+decorar repository/service/gateways) e o
  registro das próprias rotas, encapsulado como plugin Fastify. Use esta skill sempre que o
  usuário pedir para criar um módulo novo, adicionar um módulo ao app, ou perguntar onde a
  instanciação de repository/service de um módulo deveria morar — ex: "cria o módulo de X",
  "como eu registro esse módulo no app", "onde eu decoro o service novo". Aplique a convenção
  documentada abaixo antes de escrever qualquer código; se a situação não estiver coberta por ela,
  não decida sozinho — acione a skill pattern-advisor para resolver a lacuna com o usuário.
---

# Module

## Decisão (registrada em 2026-07-05)

- Cada módulo (`identity`, `pets`, `messaging`, `moderation`) ganha um arquivo
  `modules/<módulo>/<módulo>.module.ts`, que:
  1. Instancia repository/service/gateways do módulo (o que hoje mora solto em `app.ts`).
  2. Decora essas instâncias na instância Fastify (`app.decorate(...)`, mesma convenção da skill
     `dependency-injection`).
  3. Registra as próprias rotas do módulo (o plugin que hoje já existe em `<módulo>.routes.ts`,
     ex: `identityModule`/`petsModule`).
  4. É o próprio plugin Fastify exportado — `app.ts` só faz `app.register(<módulo>Module, opts)`.
- `app.ts` vira o **orquestrador**: monta o Fastify, registra plugins verdadeiramente globais
  (cors, cookie, rate-limit, swagger, `authPlugin`), e registra o `.module.ts` de cada módulo —
  sem instanciar nada de nenhum módulo específico ali dentro.
- **A pegadinha de encapsulamento do Fastify:** `register()` cria um escopo próprio — um
  `app.decorate(...)` feito dentro do `.module.ts` só é visível para aquele módulo e seus filhos,
  **não** para plugins irmãos nem para o `app` de nível raiz devolvido por `buildApp()` (ver
  [Fastify Encapsulation](https://fastify.dev/docs/latest/Reference/Encapsulation/)).
  - **Corrigido em 2026-07-05 (implementação da PR #24):** a regra não é só "algum plugin irmão lê
    esse decorator" — é "algum código fora do próprio `.register()` do módulo lê esse decorator",
    o que inclui **código fora do Fastify inteiramente**. `server.ts` lê `app.petsService` a partir
    da referência raiz devolvida por `buildApp()`, depois que ela já resolveu (`app.listen(...)`)
    — isso é a mesma barreira de encapsulamento que o caso `identityRepository`/`authPlugin`, só
    que o leitor é um script externo em vez de um plugin irmão registrado dentro do Fastify. Sem
    `fastify-plugin`, `app.petsService` fica `undefined` nesse ponto (confirmado empiricamente na
    PR #24) — a suíte de teste não pega isso porque nenhum teste toca a referência raiz depois de
    `buildApp()` resolver, só `app.inject()` (que atravessa o roteamento normal, dentro do
    encapsulamento).
  - Por isso: `identity.module.ts` usa `fastify-plugin` (`identityRepository` lido por `authPlugin`,
    plugin irmão) **e** `pets.module.ts` também usa (`petsService` lido por `server.ts` a partir da
    raiz). Na prática, hoje **todo** `.module.ts` que decora algo lido fora do próprio módulo
    precisa de `fp` — o caso "não precisa" é só quando um decorator é usado exclusivamente pelas
    próprias rotas do módulo, nunca de fora (nem por outro plugin, nem por `server.ts`/scripts).
  - Antes de decidir que um `.module.ts` novo não precisa de `fastify-plugin`, confira não só quem
    mais no Fastify lê esse decorator, mas também se `server.ts` (ou qualquer outro entrypoint fora
    do `app.ts`) precisa ler `app.<decorator>` depois que `buildApp()` retorna.
- `overrides` de teste (ver skill `testing`) continuam existindo, só mudam de lugar: em vez de
  `buildApp(env, overrides)` repassar `overrides.identityService` etc. direto pro corpo de
  `app.ts`, cada `.module.ts` recebe o override correspondente como opção de registro (ex:
  `app.register(identityModule, { env, overrides })`), e decide internamente usar o override ou
  instanciar a versão real.

**Alternativas consideradas:** manter toda a wiring de DI em `app.ts` (estado anterior a
2026-07-05) — funcionava, mas cresce linearmente com cada módulo novo (identity + pets já
deixavam `app.ts` denso; messaging/moderation tornariam isso pior), e não usava o próprio
mecanismo de encapsulamento do Fastify que já resolve isolamento de módulo de graça.

**Verificado com base em:** o sistema nativo de plugins/encapsulamento do Fastify — cada
`register()` é uma fronteira de contexto, pensada exatamente para "dividir a aplicação em blocos
coesos" (ver [Fastify Plugins Guide](https://fastify.dev/docs/latest/Guides/Plugins-Guide/)) — em
vez de introduzir uma convenção própria de "módulo" por cima do framework (ex: um decorator
`@Module()` estilo NestJS, que exigiria um container de DI que este projeto já rejeitou — ver skill
`dependency-injection`).

## Como aplicar

Ao criar um módulo novo (ou migrar a wiring de um módulo existente pra dentro dele):
1. Crie `modules/<módulo>/<módulo>.module.ts`.
2. Dentro dele, instancie repository/service/gateways do módulo e decore-os — mesmo padrão hoje
   em `app.ts`, só movido pra cá.
3. Registre as rotas do módulo (o plugin `<módulo>.routes.ts` já existente) dentro do próprio
   `.module.ts`, não em `app.ts`.
4. Confira se algum decorator desse módulo é lido fora do próprio `.register()` dele — por um
   plugin irmão (ex: `infra/auth.ts`) OU por código fora do Fastify (ex: `server.ts` lendo
   `app.<algo>` depois que `buildApp()` retorna). Se sim, envolva o `.module.ts` com
   `fastify-plugin`. Só pule isso se tiver certeza de que ninguém, em lugar nenhum, precisa ler
   aquele decorator fora das próprias rotas do módulo.
5. Em `app.ts`, troque a instanciação manual por `app.register(<módulo>Module, { env, overrides })`.
6. `declare module 'fastify' { interface FastifyInstance { ... } }` (module augmentation dos tipos
   dos decorators) pode continuar em `app.ts` (é só tipo, não wiring) ou mover pro próprio
   `.module.ts` — mantenha next ao `.module.ts` que declara os decorators, pra ficar perto de onde
   são criados.

## Se algo não estiver coberto aqui

Isso indica uma decisão nova (ex: como dois módulos que precisam se enxergar via decorator
resolveriam isso sem acoplar um `.module.ts` no outro). Não resolva sozinho — acione a skill
`pattern-advisor` para decidir isso com o usuário, e depois atualize esta skill com o resultado.
