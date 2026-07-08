---
name: gateway
description: >
  Documenta a convenção já decidida neste projeto para gateways (integração com serviços
  externos — S3, e-mail, pagamento, APIs de terceiros etc.). Use esta skill sempre que o usuário
  pedir para integrar, chamar ou estruturar acesso a um serviço externo — ex: "cria o gateway de
  X", "integra com a API de Y", "como eu chamo esse serviço externo". Aplique a convenção
  documentada abaixo antes de escrever qualquer código; se a situação não estiver coberta por ela,
  não decida sozinho — acione a skill pattern-advisor para resolver a lacuna com o usuário.
---

# Gateway

## Decisão (registrada em 2026-07-03)

- Gateway é o padrão pra qualquer integração com **sistema externo** (S3, provedor de e-mail,
  pagamento, API de terceiro). É o equivalente ao repository, só que pro mundo de fora em vez do
  banco: o repository é o único ponto que fala com o Prisma, o gateway é o único ponto que fala
  com aquele serviço externo específico.
- O gateway **não guarda lógica de negócio nem decisão** — só valores base (config, credenciais) e
  tradução entre o formato que o domínio usa e o formato que o serviço externo espera/devolve. A
  regra de negócio de quando/por que chamar o gateway, e o que fazer com o resultado, mora no
  service (ver skill `service`).
- Gateway é uma **classe concreta direta, por padrão sem interface nem driver trocável** — quando
  só existe um sistema externo real por trás, não crie uma interface especulando um segundo
  provedor que ainda não existe.
- **Exceção quando há mais de um provedor real e concreto** (não hipotético): cada provedor vira
  sua própria classe, e uma função fábrica escolhe qual instanciar. Ainda assim **sem `interface`
  declarada** — as classes só precisam bater a forma (métodos) usada por quem consome; TypeScript
  aceita isso estruturalmente (union type), sem precisar de um contrato formal. `storage` é o
  exemplo disso hoje (ver "Migração aplicada").
- Gateways moram em `apps/api/src/gateways/`, um nível acima de `modules/` — não pertencem a um
  módulo específico, mesmo que hoje só um módulo os use.
- Convenção de nome: `<serviço>.gateway.service.ts`, classe `<Serviço>GatewayService` (ex:
  `storage.gateway.service.ts` → `StorageGatewayService`). Quando há mais de um provedor real
  (exceção acima), cada um vira `<provedor>-<serviço>.gateway.service.ts` (ex:
  `local-storage.gateway.service.ts`, `s3-storage.gateway.service.ts`), e o arquivo
  `<serviço>.gateway.service.ts` original vira a fábrica que escolhe entre eles. O nome da classe é
  sempre a conversão do nome do arquivo inteiro pra PascalCase, sem descartar o segmento
  `.service` — ver skill `class-naming` pra regra geral (vale também pra `repository` e `service`).
- Só o **service** chama um gateway — nunca a rota, nunca o usecase diretamente, nunca o
  repository. Isso espelha a regra do repository: quem orquestra acesso a dado (interno ou
  externo) é o service.

**Alternativas consideradas:** uma única classe decidindo o provedor internamente (era a decisão
original pra `storage`, ver "Migração aplicada") — funcionava, mas misturava dois provedores reais
(disco local em dev, S3 em prod) dentro do mesmo `if`, então foi reaberta a favor de uma classe por
provedor; interface formal (`interface StorageGateway {}`) — rejeitada em favor de tipagem
estrutural (union type), simples o bastante pra dois provedores sem precisar declarar um contrato
à parte.

**Cuidado ao aplicar a exceção:** "ambiente diferente" não é sinônimo de "provedor diferente".
LocalStack (dev) e o SQS real da AWS (prod) usam o mesmo SDK e protocolo (`@aws-sdk/client-sqs`) —
só o endpoint muda via env (`SQS_ENDPOINT`, ausente em prod). Tecnicamente isso seria o caso
**default** (uma classe só), não a exceção — diferente de `storage`, onde disco local e S3 são
protocolos genuinamente diferentes (sistema de arquivos vs API HTTP). Mesmo assim, o usuário pediu
explicitamente pra aplicar a exceção aqui também (Strategy pattern) por consistência/aprendizado,
mesmo sem a necessidade técnica estrita — ver "Reabertura de 2026-07-05" abaixo pro desvio de onde
a escolha de estratégia mora.

**Reabertura de 2026-07-05 — fila de pets vira exceção, com a escolha no service:** diferente de
`storage` (onde a fábrica `createStorageGateway(env)` mora no PRÓPRIO arquivo de gateway, e o
service só recebe o resultado já escolhido), aqui o usuário pediu que a decisão de qual estratégia
usar (SQS real vs LocalStack) fique no **service** (`PetsService`), não numa fábrica dentro de
`gateways/`. O service recebe as duas instâncias de gateway (ou uma referência a ambas) via
construtor e decide, com base em `env`, qual `.enqueue(...)` chamar. Isso é uma exceção pontual à
regra geral de "gateway concentra sua própria fábrica" — documentada aqui para não virar precedente
silencioso para outros gateways com múltiplo provedor (ex: se `storage` for tocado de novo, a
fábrica continua sendo a forma padrão, a menos que reaberto explicitamente de novo).

**Verificado com base em:** o padrão de **Gateway** (Martin Fowler, Patterns of Enterprise
Application Architecture) — um objeto que encapsula acesso a um sistema externo, contendo só a
lógica de tradução entre os termos do domínio e os termos do sistema externo, nada de regra de
negócio.

## Migração aplicada

O `StorageProvider` (`shared/storage/`, interface + `LocalStorageProvider`/`S3StorageProvider`)
existia antes dessa decisão e foi consolidado em `gateways/storage.gateway.service.ts` como uma única
classe `StorageGatewayService`, que decidia local-disco vs S3 internamente por `env.STORAGE_DRIVER`
— sem interface. `shared/storage/` foi removido.

Essa decisão foi reaberta em seguida: `storage` genuinamente tem dois provedores reais e
concretos (disco local em dev, S3 em prod), não um hipotético — então virou a exceção descrita
acima. Hoje:
- `gateways/local-storage.gateway.service.ts` → `LocalStorageGatewayService`.
- `gateways/s3-storage.gateway.service.ts` → `S3StorageGatewayService`.
- `gateways/storage.gateway.service.ts` → só a função `createStorageGateway(env)`, que escolhe uma das duas
  por `env.STORAGE_DRIVER` e devolve o tipo `StorageGateway = LocalStorageGatewayService |
  S3StorageGatewayService` (union, sem `interface` declarada).
- `read()` (leitura crua de disco, usada só pela rota estática dev-only) existe **apenas** em
  `LocalStorageGatewayService` — não foi replicado em `S3StorageGatewayService` só pra bater a
  forma, porque S3 genuinamente não serve esse caso (ver skill `exception-handler`: nunca force um
  método que lança "not supported" só pra imitar uma interface).

Fila SQS pro cadastro de pet (registrada em 2026-07-04, revisada em 2026-07-05): evita perda de
cadastro por sobrecarga do banco — rota enfileira e responde, um consumidor assíncrono (worker
em background dentro do próprio `apps/api`, ver skill `infra-placement` e o poller/`sqs-consumer`
em `pollers/`) persiste depois. Desde 2026-07-05, vira a exceção Strategy (ver "Reabertura de
2026-07-05" acima): `gateways/sqs-queue.gateway.service.ts` (`SqsQueueGatewayService`) e
`gateways/localstack-queue.gateway.service.ts` (`LocalStackQueueGatewayService`), ambas com a
mesma forma (`enqueue`/`receiveMessages`/`deleteMessage`) — sem fábrica dentro de `gateways/`
dessa vez, já que a escolha entre as duas mora no `PetsService`, não num arquivo de gateway.

**Nota (registrada em 2026-07-04):** os nomes de classe acima (`StorageGatewayService`,
`LocalStorageGatewayService`, `S3StorageGatewayService`, `PetsRegistrationQueueGatewayService`)
refletem a convenção de nome-de-classe-espelha-nome-de-arquivo decidida na skill `class-naming` —
antes dessa decisão, essas classes eram nomeadas `StorageGateway`, `LocalStorageGateway`,
`S3StorageGateway` e `PetsRegistrationQueueGateway` (descartando o segmento `.service` do arquivo).

## Como aplicar

Ao integrar um serviço externo novo:
1. Crie `apps/api/src/gateways/<serviço>.gateway.service.ts` com uma classe
   `<Serviço>GatewayService` — métodos que refletem o que o domínio precisa fazer (ex: `send`,
   `charge`), não os endpoints crus da API externa.
2. A classe recebe config/credenciais (via `Env`) e traduz entre o formato do domínio e o formato
   exigido pelo serviço externo — nada de decisão de negócio aqui dentro.
3. Só o service do módulo que precisa dessa integração importa e chama o gateway.
4. Se o gateway precisa validar/tipar o que entra ou sai dele, ele também pode ter seus próprios
   `<serviço>.schemas.ts` e `<serviço>.dto.ts` dentro de `apps/api/src/gateways/` — mesma convenção
   de schema→DTO usada nos módulos (ver skill `dto`), um par de arquivos por gateway (não um
   `dto.ts`/`schemas.ts` compartilhado por todos os gateways, já que cada um é um sistema externo
   diferente).

## Se algo não estiver coberto aqui

Isso indica uma decisão nova (ex: um caso real de precisar trocar de provedor externo, exigindo
introduzir uma interface onde hoje não existe). Não resolva sozinho — acione a skill
`pattern-advisor` para decidir isso com o usuário, e depois atualize esta skill com o resultado.
