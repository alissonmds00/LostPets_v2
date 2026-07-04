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

## Decisão (registrada em 2026-07-03)

- **Teste vem antes da implementação, em cada camada** — usecase, service e repository ganham
  cada um seu próprio teste escrito antes do código que ele testa, não só um teste de ponta a
  ponta por feature.
- **Todo teste é comportamental**: testa o resultado observável de chamar a coisa (o que ela
  retorna, que erro lança, o que fica salvo), nunca implementação interna. Nenhuma camada mocka um
  colaborador interno — é consistente com a decisão já fixada em
  [ARCHITECTURE.md](../../../ARCHITECTURE.md) de rodar integração contra Postgres real via Docker,
  não mocks.
  - **Usecase:** teste de API via `app.inject()` do Fastify — chama a rota de verdade, com
    usecase, service e repository reais por baixo, banco real.
  - **Service:** chama o método do service diretamente (sem passar pela rota), ainda contra
    repository e banco reais.
  - **Repository:** chama o método do repository direto contra o Postgres real (via Docker).
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

**Alternativas consideradas:** mockar o repository nos testes de service (rejeitado — contraria a
decisão já fixada de rodar contra banco real, e reintroduziria exatamente o tipo de teste
acoplado-à-implementação que a abordagem comportamental evita); testar só no nível de usecase, sem
teste isolado de service/repository (rejeitado pelo usuário em favor de cobertura em cada camada).

**Verificado com base em:** a abordagem clássica de TDD ("Chicago school") — testar contra a
interface pública/resultado observável do sistema, evitando mock de colaborador interno, porque
isso deixa o teste acoplado a como o código é escrito por dentro, não ao que ele deveria fazer; e o
suporte nativo do Fastify a testes de rota via `app.inject()`, sem precisar de lib externa tipo
supertest.

## Como aplicar

Ao implementar uma rota/usecase novo:
1. Escreva o teste de repository (contra Postgres real) e rode — deve falhar porque o método não
   existe. Implemente o repository até passar.
2. Escreva o teste de service (chamando o método direto, repository real por baixo) e rode — deve
   falhar. Implemente o service até passar.
3. Escreva o teste de usecase (via `app.inject()` na rota) e rode — deve falhar. Implemente
   usecase + rota até passar.
4. Arquivos de teste ficam em `apps/api/test/`, espelhando a estrutura de módulos/usecases —
   mesma convenção já usada em `test/health.test.ts`.

## Se algo não estiver coberto aqui

Isso indica uma decisão nova (ex: como testar o WebSocket de `messaging`, ou um caso que
genuinamente pareça exigir um mock em vez de infra real). Não resolva sozinho — acione a skill
`pattern-advisor` para decidir isso com o usuário, e depois atualize esta skill com o resultado.
