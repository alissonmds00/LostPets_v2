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
- Gateway é uma **classe concreta direta**, sem interface nem driver trocável — mesmo quando o
  gateway decide internamente entre mais de um comportamento (ex: local vs S3), isso fica dentro
  da própria classe, não em implementações separadas atrás de uma interface.
- Gateways moram em `apps/api/src/gateways/`, um nível acima de `modules/` — não pertencem a um
  módulo específico, mesmo que hoje só um módulo os use.
- Convenção de nome: `<serviço>.gateway.ts`, classe `<Serviço>Gateway` (ex: `storage.gateway.ts` →
  `StorageGateway`).
- Só o **service** chama um gateway — nunca a rota, nunca o usecase diretamente, nunca o
  repository. Isso espelha a regra do repository: quem orquestra acesso a dado (interno ou
  externo) é o service.

**Alternativas consideradas:** manter interface + driver trocável por serviço externo (como o
`StorageProvider` antigo) — rejeitado como convenção geral porque a maioria das integrações não
tem um segundo provedor real esperando pra ser trocado; quando isso for um caso concreto (não
hipotético), introduzir a interface ali é uma decisão nova, não a regra padrão.

**Verificado com base em:** o padrão de **Gateway** (Martin Fowler, Patterns of Enterprise
Application Architecture) — um objeto que encapsula acesso a um sistema externo, contendo só a
lógica de tradução entre os termos do domínio e os termos do sistema externo, nada de regra de
negócio.

## Migração aplicada

O `StorageProvider` (`shared/storage/`, interface + `LocalStorageProvider`/`S3StorageProvider`)
existia antes dessa decisão e foi consolidado em `gateways/storage.gateway.ts` como uma única
classe `StorageGateway`, que decide local-disco vs S3 internamente por `env.STORAGE_DRIVER` — sem
interface. `shared/storage/` foi removido; nada mais no projeto o importava ainda, então não há
nenhuma outra referência pra atualizar.

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
