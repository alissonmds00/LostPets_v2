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

## Decisão (registrada em 2026-07-03, revisada em 2026-07-04, revisada de novo em 2026-07-04)

- **Teste vem antes da implementação, em cada camada** — usecase, service e repository ganham
  cada um seu próprio teste escrito antes do código que ele testa, não só um teste de ponta a
  ponta por feature.
- **Todo teste é comportamental**: testa o resultado observável de chamar a coisa (o que ela
  retorna, que erro lança, o que fica salvo), nunca implementação interna.
- **Nenhum teste automatizado toca infraestrutura real** (revisado em 2026-07-04, segunda vez):
  nem Postgres, nem gateway externo (S3/LocalStack, fila SQS). Isso é uma separação deliberada
  entre **ambiente de teste automatizado** (roda em CI/local sem Docker, tudo mockado, rápido) e
  **ambiente de QA** (Docker com Postgres/LocalStack de verdade, ou um ambiente de staging
  implantado, onde a integração real é validada manualmente/exploratoriamente pelo usuário — não
  pela suíte automatizada).
  - **Repository: mocka o `PrismaClient`.** Usa `vitest-mock-extended` (`mockDeep<PrismaClient>()`)
    substituindo o singleton exportado por `infra/db/prisma.ts` via `vi.mock(...)` — o teste
    continua chamando o método do repository de verdade (`repository.findByEmail(...)`), só o que
    está por baixo (`prisma.user.findUnique`) é um mock configurável (`mockResolvedValue`/
    `mockRejectedValue`), sem precisar de constructor injection no repository (a classe continua
    importando o singleton normalmente em produção).
  - **Service: mocka o repository**, via o mesmo construtor usado em produção (decisão de
    2026-07-04, mantida). Se o service também chamar um **gateway**, mocka o gateway do mesmo jeito
    (novo nesta revisão) — nenhum colaborador externo ao service (repository ou gateway) é real no
    teste de service.
  - **Usecase/rota: mocka o service** (novo nesta revisão). O teste continua via `app.inject()` do
    Fastify (não muda a forma de chamar a rota), mas a app é construída com um service mockado no
    lugar do real — ver `buildApp` abaixo. Isso testa o contrato HTTP (validação Zod, status code,
    shape da resposta, cookie) sem depender de banco nem gateway reais.
- **Como mockar o service dentro de `app.inject()`:** `buildApp(env)` em `apps/api/src/app.ts`
  ganha um segundo parâmetro opcional, `overrides` (ex:
  `buildApp(env, { identityService: mockIdentityService })`), usado **só em teste** — em produção
  `buildApp(env)` continua chamado sem esse parâmetro, instanciando repository/service reais como
  hoje. Quando um override é passado para um service, o `app.decorate` correspondente usa o mock em
  vez de construir o repository/service reais — ainda assim só é decorado uma vez, mesmo padrão de
  DI (`fastify.decorate`) já usado, só que a fonte da instância passa a ser configurável.
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
- **Docker (Postgres/LocalStack) não é mais pré-requisito pra rodar a suíte automatizada.**
  Continua existindo (`docker-compose.yml`) para desenvolvimento local e para o ambiente de QA —
  onde o usuário valida manualmente a integração real —, só não é mais acionado pelos testes
  automatizados em nenhuma camada.

**Alternativas consideradas (2026-07-03):** mockar o repository nos testes de service (inicialmente
rejeitado, depois revertido em 2026-07-04).

**Revisão de 2026-07-04 (primeira):** mock só na camada de service (repository continuava contra
banco real; usecase/rota continuava sem mock). Superada pela revisão abaixo.

**Revisão de 2026-07-04 (segunda, esta):** o usuário pediu explicitamente para separar o conceito
de ambiente de QA (onde ele quer testar a aplicação de verdade, manualmente) do ambiente de teste
automatizado — e que testes automatizados não façam nenhuma chamada real a repository nem a
gateway. Confirmado via `AskUserQuestion` que isso vale até para o teste de repository (que agora
mocka o `PrismaClient`, não só o service mockando o repository) — nenhuma camada do suíte
automatizado toca infra real. Escopo: retroativo a tudo que já existe (`identity`), não só a
módulos novos.

**Verificado com base em:** o guia oficial do Prisma pra unit testing
(`vitest-mock-extended`/`jest-mock-extended` mockando o `PrismaClient` via substituição do módulo
singleton) é a abordagem documentada pela própria Prisma para isolar testes de repository do banco
real sem precisar reescrever a classe pra aceitar o client via construtor.

## Como aplicar

Ao implementar uma rota/usecase novo:
1. Escreva o teste de repository **mockando o `PrismaClient`** (`vi.mock('caminho/pra/infra/db/
   prisma.js', () => ({ prisma: mockDeep<PrismaClient>() }))`, import do mock via
   `vitest-mock-extended`) e rode — deve falhar porque o método não existe. Implemente o
   repository até passar, configurando o mock (`prismaMock.user.create.mockResolvedValue(...)`)
   pra cada cenário.
2. Escreva o teste de service **mockando o repository** (e gateway, se houver) — mesmo construtor
   usado em produção — e rode — deve falhar. Implemente o service até passar. Verifique tanto o
   retorno/erro do service quanto, onde fizer sentido, com quais argumentos os mocks foram
   chamados.
3. Escreva o teste de usecase/rota via `app.inject()`, construindo a app com
   `buildApp(env, { <nome>Service: serviceMock })` — sem banco nem gateway reais — e rode — deve
   falhar. Implemente usecase + rota até passar.
4. Arquivos de teste ficam em `apps/api/test/`, espelhando a estrutura de módulos/usecases —
   mesma convenção já usada em `test/health.test.ts`.

## Se algo não estiver coberto aqui

Isso indica uma decisão nova (ex: como testar o WebSocket de `messaging` sem infra real, ou um caso
que genuinamente pareça exigir infra real mesmo no suíte automatizado). Não resolva sozinho —
acione a skill `pattern-advisor` para decidir isso com o usuário, e depois atualize esta skill com
o resultado.
