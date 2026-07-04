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
- Convenção de nome: `<serviço>.gateway.ts`, classe `<Serviço>Gateway` (ex: `storage.gateway.ts` →
  `StorageGateway`). Quando há mais de um provedor real (exceção acima), cada um vira
  `<provedor>-<serviço>.gateway.ts` (ex: `local-storage.gateway.ts`, `s3-storage.gateway.ts`), e o
  arquivo `<serviço>.gateway.ts` original vira a fábrica que escolhe entre eles.
- Só o **service** chama um gateway — nunca a rota, nunca o usecase diretamente, nunca o
  repository. Isso espelha a regra do repository: quem orquestra acesso a dado (interno ou
  externo) é o service.

**Alternativas consideradas:** uma única classe decidindo o provedor internamente (era a decisão
original pra `storage`, ver "Migração aplicada") — funcionava, mas misturava dois provedores reais
(disco local em dev, S3 em prod) dentro do mesmo `if`, então foi reaberta a favor de uma classe por
provedor; interface formal (`interface StorageGateway {}`) — rejeitada em favor de tipagem
estrutural (union type), simples o bastante pra dois provedores sem precisar declarar um contrato
à parte.

**Verificado com base em:** o padrão de **Gateway** (Martin Fowler, Patterns of Enterprise
Application Architecture) — um objeto que encapsula acesso a um sistema externo, contendo só a
lógica de tradução entre os termos do domínio e os termos do sistema externo, nada de regra de
negócio.

## Migração aplicada

O `StorageProvider` (`shared/storage/`, interface + `LocalStorageProvider`/`S3StorageProvider`)
existia antes dessa decisão e foi consolidado em `gateways/storage.gateway.ts` como uma única
classe `StorageGateway`, que decidia local-disco vs S3 internamente por `env.STORAGE_DRIVER` — sem
interface. `shared/storage/` foi removido.

Essa decisão foi reaberta em seguida: `storage` genuinamente tem dois provedores reais e
concretos (disco local em dev, S3 em prod), não um hipotético — então virou a exceção descrita
acima. Hoje:
- `gateways/local-storage.gateway.ts` → `LocalStorageGateway`.
- `gateways/s3-storage.gateway.ts` → `S3StorageGateway`.
- `gateways/storage.gateway.ts` → só a função `createStorageGateway(env)`, que escolhe uma das duas
  por `env.STORAGE_DRIVER` e devolve o tipo `StorageGateway = LocalStorageGateway |
  S3StorageGateway` (union, sem `interface` declarada).
- `read()` (leitura crua de disco, usada só pela rota estática dev-only) existe **apenas** em
  `LocalStorageGateway` — não foi replicado em `S3StorageGateway` só pra bater a forma, porque S3
  genuinamente não serve esse caso (ver skill `exception-handler`: nunca force um método que lança
  "not supported" só pra imitar uma interface).

## Como aplicar

Ao integrar um serviço externo novo:
1. Crie `apps/api/src/gateways/<serviço>.gateway.ts` com uma classe `<Serviço>Gateway` — métodos
   que refletem o que o domínio precisa fazer (ex: `send`, `charge`), não os endpoints crus da API
   externa.
2. A classe recebe config/credenciais (via `Env`) e traduz entre o formato do domínio e o formato
   exigido pelo serviço externo — nada de decisão de negócio aqui dentro.
3. Só o service do módulo que precisa dessa integração importa e chama o gateway.

## Se algo não estiver coberto aqui

Isso indica uma decisão nova (ex: um caso real de precisar trocar de provedor externo, exigindo
introduzir uma interface onde hoje não existe). Não resolva sozinho — acione a skill
`pattern-advisor` para decidir isso com o usuário, e depois atualize esta skill com o resultado.
