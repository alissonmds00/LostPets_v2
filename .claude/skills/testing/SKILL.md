---
name: testing
description: >
  Documenta a convenção já decidida neste projeto para testes — comportamentais, escritos antes da
  implementação (TDD), em cada camada. Use esta skill sempre que o usuário pedir para implementar
  qualquer rota/usecase/service/repository nova, ou pedir explicitamente pra escrever teste — já
  que, por convenção, nenhuma dessas camadas é implementada sem um teste escrito antes. Aplique a
  convenção documentada abaixo antes de escrever qualquer código; se a situação não estiver coberta
  por ela, não decida sozinho — acione a skill pattern-advisor para resolver a lacuna com o
  usuário.
---

# Testing

## Decisão (registrada em 2026-07-03, revisada em 2026-07-04)

- **Teste vem antes da implementação, em cada camada** — usecase, service e repository ganham
  cada um seu próprio teste escrito antes do código que ele testa, não só um teste de ponta a
  ponta por feature.
- **Todo teste é comportamental**: testa o resultado observável de chamar a coisa (o que ela
  retorna, que erro lança, o que fica salvo), nunca implementação interna.
  - **Usecase:** teste de API via `app.inject()` do Fastify — chama a rota de verdade, com
    usecase, service e repository reais por baixo, banco real. Continua sem mock — é o teste de
    integração de ponta a ponta da feature.
  - **Service: mocka o repository** (revisado em 2026-07-04). O service recebe um repository
    fake/mock (ex: `vi.fn()`/objeto com métodos stubados) via o mesmo construtor usado em produção
    — testa só a regra de negócio do service isolada (o que ele decide, que erro lança, com quais
    argumentos chama o repository), sem precisar do Postgres rodando pra esse nível. Nenhum outro
    colaborador do service é mockado além do repository (ex: se o service um dia depender de outro
    serviço/gateway, mocka também — mas não mocka partes do próprio service).
  - **Repository:** chama o método do repository direto contra o Postgres real (via Docker) — não
    tem como mockar aqui, é a própria integração com o banco que está sendo testada.
- **Ciclo obrigatório (red → green):**
  1. Escreva o teste primeiro.
  2. Rode o teste e confirme que ele falha — e falha pelo **motivo certo** (a funcionalidade não
     existe ainda), não por um erro acidental no próprio teste (import errado, sintaxe quebrada).
  3. Implemente até o teste passar de verdade — rodando-o, não assumindo que passaria pela leitura
     do código.
- **A tarefa só está concluída quando os testes passam de fato, executados.** Um teste "verde" que
  na real não estava exercitando o código (por um problema de sintaxe silencioso, por exemplo) não
  conta — é exatamente o motivo do passo 2 do ciclo acima: sem ver o vermelho primeiro, não dá pra
  confiar no verde depois.

**Alternativas consideradas (2026-07-03):** mockar o repository nos testes de service (inicialmente
rejeitado, depois revertido em 2026-07-04 — ver revisão abaixo); testar só no nível de usecase, sem
teste isolado de service/repository (rejeitado pelo usuário em favor de cobertura em cada camada,
decisão que continua valendo).

**Revisão de 2026-07-04:** o usuário pediu explicitamente que os testes usem mock em vez de chamada
de classe concreta. Decisão tomada via skill `pattern-advisor`: mock só na camada de service
(repository continua contra banco real; usecase/rota continua sem mock, contra service+repository+
banco reais). Escopo: aplica-se retroativamente também ao módulo `identity` já mesclado, não só a
módulos novos (`pets` em diante) — os testes de service já escritos foram reescritos para mockar o
repository em vez de rodar contra Postgres real.

**Verificado com base em:** a abordagem clássica de TDD ("Chicago school", contra a interface
pública/resultado observável) permanece para repository e usecase; para service, adotada a
abordagem "London school" (mock de colaborador direto) especificamente para essa camada, por
decisão explícita do usuário — service isolado do banco fica mais rápido de rodar e testa a regra
de negócio sem depender de estado de dados externo.

## Como aplicar

Ao implementar uma rota/usecase novo:
1. Escreva o teste de repository (contra Postgres real) e rode — deve falhar porque o método não
   existe. Implemente o repository até passar.
2. Escreva o teste de service **mockando o repository** (ex: `{ create: vi.fn(), findByEmail:
   vi.fn(), ... }` passado no lugar do repository real no construtor do service) e rode — deve
   falhar. Implemente o service até passar. Verifique tanto o retorno/erro do service quanto, onde
   fizer sentido, com quais argumentos o mock do repository foi chamado.
3. Escreva o teste de usecase (via `app.inject()` na rota, sem mock, repository e banco reais) e
   rode — deve falhar. Implemente usecase + rota até passar.
4. Arquivos de teste ficam em `apps/api/test/`, espelhando a estrutura de módulos/usecases —
   mesma convenção já usada em `test/health.test.ts`.

## Se algo não estiver coberto aqui

Isso indica uma decisão nova (ex: como testar o WebSocket de `messaging`, ou um caso que
genuinamente pareça exigir um mock em vez de infra real). Não resolva sozinho — acione a skill
`pattern-advisor` para decidir isso com o usuário, e depois atualize esta skill com o resultado.
