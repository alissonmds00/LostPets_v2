---
name: dependency-injection
description: >
  Documenta a convenção já decidida neste projeto para instanciar e injetar services/repositories
  (dependency injection). Use esta skill sempre que o usuário pedir para instanciar, conectar ou
  "ligar" uma camada nova (service, repository) na aplicação, perguntar onde um `new XService()`
  deveria acontecer, ou revisar se algo está sendo instanciado do jeito certo — ex: "onde eu crio
  esse repository", "como eu injeto isso no service", "por que tem `new X()` espalhado". Aplique a
  convenção documentada abaixo antes de escrever qualquer código; se a situação não estiver coberta
  por ela, não decida sozinho — acione a skill pattern-advisor para resolver a lacuna com o usuário.
---

# Dependency Injection

## Decisão (registrada em 2026-07-04)

- Services e repositories são instanciados **exatamente uma vez**, em `apps/api/src/app.ts`, e
  decorados na instância raiz do Fastify (`app.decorate('identityRepository', ...)`,
  `app.decorate('identityService', ...)`) — **antes** de registrar qualquer plugin/módulo que
  precise deles (`app.register(authPlugin, ...)`, `app.register(identityPlugin, ...)`, etc.).
- Decorators adicionados diretamente na instância raiz (fora de um `.register()` aninhado) são
  herdados automaticamente por todo contexto filho registrado depois — não precisa envolver isso
  com `fastify-plugin` (`fp`). Isso é o oposto do caso do `authPlugin`: lá, `fp` é necessário porque
  os decorators são adicionados **dentro** de um plugin e precisam subir para o escopo pai; aqui, os
  decorators já nascem no escopo pai e descem naturalmente para os filhos.
- Repository e service são tipados via module augmentation do Fastify, mesma técnica já usada em
  `infra/auth.ts` para `requireAuth`/`requireRole`:
  ```typescript
  declare module 'fastify' {
    interface FastifyInstance {
      identityRepository: IdentityRepository;
      identityService: IdentityService;
    }
  }
  ```
- **Usecases e rotas nunca fazem `new XService()`/`new XRepository()`.** Eles recebem a instância
  já pronta como parâmetro, buscada em `app.<nomeDecorado>` por quem chama (a rota sempre tem `app`
  no escopo, então ela é quem repassa a instância pro usecase/service).
- Um service que precisa de um repository recebe a instância do repository injetada no **construtor**
  do service (`new IdentityService(identityRepository)`), montada uma única vez junto com o
  `app.decorate` — nunca o service instanciando seu próprio repository internamente.

**Alternativas consideradas:** `@fastify/awilix` (container de DI com cradle/resolver) — rejeitado
porque o problema real levantado no code review (acoplamento por `new X()` espalhado pelo código)
já é resolvido pelo mecanismo nativo do Fastify (`decorate`); adicionar um container introduziria um
conceito novo (cradle, registration, resolution mode) sem resolver nada que `decorate` já não
resolvesse, contrariando o objetivo de aprender o próprio framework antes de somar bibliotecas.

### Caso explícito: ciclo de vida do Prisma (registrado em 2026-07-10)

O `PrismaClient` era a única exceção a esta convenção: `infra/db/prisma.ts` exporta um singleton nu
(`export const prisma = new PrismaClient();`) que cada repository importava direto, passando ao
largo do ciclo de vida do Fastify. Isso fechou essa lacuna alinhando o Prisma ao mesmo padrão de DI
de qualquer outro colaborador:

- O singleton em si continua existindo em `infra/db/prisma.ts` sem mudança — o que muda é como ele
  chega a cada repository.
- Decorado **uma vez** em `app.ts`, junto dos outros decorates e antes de qualquer
  `app.register(...)` que dependa dele: `app.decorate('prisma', prisma)`, com o
  `declare module 'fastify' { interface FastifyInstance { prisma: PrismaClient; } }`
  correspondente.
- Desconectado via `app.addHook('onClose', async (instance) => { await instance.prisma.$disconnect();
  })` — o guia oficial Fastify+Prisma (fastify.dev/docs/latest/Guides/Prisma) recomenda exatamente
  isso: o `onClose` só dispara quando algo chama `app.close()` (ver o handler de
  `SIGTERM`/`SIGINT` em `server.ts`, que é o que de fato aciona isso em produção).
- Injetado no **construtor** de cada repository, como qualquer outra dependência desta convenção —
  `new IdentityRepository(prisma)`, `new PetsRepository(prisma)` — e usado como `this.prisma.*`
  dentro da classe, em vez de importar o módulo `infra/db/prisma.ts` diretamente. Isso também
  simplifica o teste de repository: mockar o `PrismaClient` agora é injeção direta via construtor
  (`mockDeep<PrismaClient>()` passado pra `new XRepository(prismaMock)`), sem precisar de
  `vi.mock(...)` substituindo o módulo — ver skill `testing`.

## Como aplicar

Ao ligar um service/repository novo na aplicação:
1. Em `app.ts`, instancie o repository e o service (injetando o repository no construtor do
   service) **uma vez**, antes de qualquer `app.register(...)` que dependa deles.
2. Decore ambos na instância raiz: `app.decorate('<nome>Repository', instance)`,
   `app.decorate('<nome>Service', instance)`.
3. Adicione o `declare module 'fastify' { interface FastifyInstance { ... } }` correspondente no
   mesmo arquivo onde o decorate acontece (ou no arquivo do plugin, se o decorate morar lá — como em
   `infra/auth.ts`).
4. Na rota (skill `controller`), leia a instância de `app.<nomeDecorado>` e repasse como parâmetro
   pro usecase (skill `usecase`); o usecase repassa pro(s) service(s) que ele orquestra. Nenhuma
   camada instancia a própria dependência.
5. Hoje só `identityRepository` está decorado (`identity.service.ts` ainda não existe — register/
   login são PRs separadas em aberto). Quando `identity.service.ts` existir, `identityService` é
   decorado do mesmo jeito, seguindo os passos acima.

## Se algo não estiver coberto aqui

Isso indica uma decisão nova (ex: um service que depende de múltiplos repositories de módulos
diferentes, um gateway precisando do mesmo tratamento, ciclo de vida diferente por ambiente
de teste). Não resolva sozinho — acione a skill `pattern-advisor` para decidir isso com o usuário,
e depois atualize esta skill com o resultado.
