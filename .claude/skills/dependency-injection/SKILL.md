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

## Decisão (registrada em 2026-07-04, revisada em 2026-07-05)

- Services e repositories são instanciados **exatamente uma vez**, decorados via
  `app.decorate('identityRepository', ...)`/`app.decorate('identityService', ...)` — **antes** de
  registrar qualquer plugin que precise deles.
- **Onde a instanciação mora (revisado em 2026-07-05):** não mais centralizada em `app.ts` — cada
  módulo instancia/decora seu próprio repository/service dentro do seu próprio
  `<módulo>.module.ts` (ver skill `module`). `app.ts` virou o orquestrador: só registra o
  `.module.ts` de cada módulo, sem `new X()` nenhum ali dentro.
- Decorators adicionados diretamente na instância raiz (fora de um `.register()` aninhado) são
  herdados automaticamente por todo contexto filho registrado depois — não precisa de
  `fastify-plugin` (`fp`) pra essa direção. Como a wiring agora acontece **dentro** de um
  `.register()` (o próprio `.module.ts`), isso muda o cálculo: um decorator feito lá só é visível
  para aquele módulo e seus filhos, não para plugins irmãos. Quando um decorator precisa ser visto
  por fora (hoje só `identityRepository`, por causa de `requireAuth` em `infra/auth.ts`), o
  `.module.ts` correspondente usa `fp` pra borbulhar o decorator pro escopo pai — mesma técnica que
  `authPlugin` já usa pro motivo inverso. Ver skill `module` pra esse detalhe completo.
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

## Como aplicar

Ao ligar um service/repository novo na aplicação:
1. No `<módulo>.module.ts` do módulo dono (ver skill `module`), instancie o repository e o service
   (injetando o repository no construtor do service) **uma vez**, antes de registrar as rotas do
   próprio módulo.
2. Decore ambos: `app.decorate('<nome>Repository', instance)`, `app.decorate('<nome>Service',
   instance)` — envolva o `.module.ts` com `fastify-plugin` só se algum plugin irmão precisar
   enxergar esse decorator (ver skill `module`).
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
