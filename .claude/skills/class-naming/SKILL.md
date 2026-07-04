---
name: class-naming
description: >
  Documenta a convenção já decidida neste projeto para nome de classe em qualquer padrão
  organizado como uma-classe-por-arquivo (repository, service, gateway, e qualquer futuro padrão
  equivalente). Use esta skill sempre que o usuário pedir para nomear, renomear ou revisar o nome
  de uma classe — ex: "como eu nomeio essa classe", "esse nome de classe tá certo?", "revisa se
  isso bate com o nome do arquivo". Aplique a convenção documentada abaixo antes de escrever
  qualquer código; se a situação não estiver coberta por ela, não decida sozinho — acione a skill
  pattern-advisor para resolver a lacuna com o usuário.
---

# Class naming

## Decisão (registrada em 2026-07-04)

- O nome de uma classe é a conversão pra PascalCase do **nome inteiro do arquivo**, todo segmento
  separado por ponto antes do `.ts`, sem descartar nenhum segmento. Isso vale pra qualquer padrão
  organizado como uma-classe-por-arquivo já decidido neste projeto (`repository`, `service`,
  `gateway`) e qualquer futuro que siga a mesma forma.
- Essa decisão reabre e substitui a convenção anterior de `gateway` (registrada em 2026-07-03), que
  descartava o segmento `.service` do nome do arquivo ao formar o nome da classe (ex:
  `local-storage.gateway.service.ts` → `LocalStorageGateway`). Isso criava uma divergência entre o
  que o arquivo diz e o que a classe diz — quem lê só o nome da classe não sabe que o arquivo tem
  um segmento a mais.
- Exemplo concreto da mudança: `pets-registration-queue.gateway.service.ts` → classe
  `PetsRegistrationQueueGatewayService` (todos os quatro segmentos — `pets-registration-queue`,
  `gateway`, `service` — convertidos e concatenados em PascalCase), não mais o antigo
  `PetsRegistrationQueueGateway`.
- Arquivos que já batiam essa regra antes mesmo dela existir não precisam mudar: `identity.repository.ts`
  → `IdentityRepository` já é a conversão direta do nome do arquivo (`identity` + `repository`, sem
  segmento a mais pra descartar), então não houve renomeação nenhuma ali.

**Alternativas consideradas:** manter a convenção anterior de descartar o segmento `.service` do
nome do arquivo gateway ao formar o nome da classe (rejeitada — gerava um nome de classe que não
reflete o arquivo real, obrigando quem lê o import a lembrar da regra de exceção em vez de só
converter o nome do arquivo).

## Como aplicar

Ao nomear a classe de um arquivo `<algo>.<padrão>.ts` (ou com mais segmentos, tipo
`<algo>.<padrão>.<sufixo>.ts`):
1. Pegue o nome do arquivo sem a extensão `.ts`.
2. Separe por `.` — cada parte é um segmento.
3. Converta cada segmento pra PascalCase (incluindo separar por `-` dentro do segmento, se houver,
   ex: `pets-registration-queue` → `PetsRegistrationQueue`) e concatene todos, na ordem em que
   aparecem no nome do arquivo.
4. Não descarte nenhum segmento — mesmo que pareça redundante (`.service` depois de `.gateway`,
   por exemplo).

## Se algo não estiver coberto aqui

Isso indica uma decisão nova (ex: um padrão de arquivo que não é uma-classe-por-arquivo, ou um
caso onde o nome resultante fica genuinamente ambíguo). Não resolva sozinho — acione a skill
`pattern-advisor` para decidir isso com o usuário, e depois atualize esta skill com o resultado.
