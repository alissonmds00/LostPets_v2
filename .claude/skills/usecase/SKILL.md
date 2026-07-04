---
name: usecase
description: >
  Documenta a convenção já decidida neste projeto para a camada de usecase (application layer).
  Use esta skill sempre que o usuário pedir para criar, estruturar ou revisar um fluxo de negócio
  que envolve uma rota da API — ex: "cria o usecase de X", "monta o fluxo de Y", "implementa a
  operação de Z" — já que TODA rota deste projeto passa por um usecase, mesmo operações simples de
  um módulo só. Aplique a convenção documentada abaixo antes de escrever qualquer código; se a
  situação não estiver coberta por ela, não decida sozinho — acione a skill pattern-advisor para
  resolver a lacuna com o usuário.
---

# Usecase (application layer)

## Decisão (registrada em 2026-07-03)

- Camadas: `route → usecase → service → repository`. **Toda** rota chama um usecase — mesmo uma
  operação simples que só usa um service de um módulo — não existe atalho `route → service`.
- O usecase existe para orquestrar **services**, especialmente quando uma operação de negócio
  precisa de mais de um módulo (ex: denunciar um anúncio precisa do service de `moderation` e do
  service de `pets`). Ele não fala com repository nem com Prisma diretamente — só com services.
- **Um service nunca chama o service de outro módulo.** Essa é a mudança na regra dura do projeto:
  comunicação entre módulos deixou de ser "via serviço público do outro módulo" e passou a ser
  exclusivamente via usecase. Isso existe para o motivo que o usuário trouxe: evitar acoplamento
  service-a-service (um service mudar não deveria quebrar outro service só porque um chamava o
  outro direto).
- Usecases moram em `apps/api/src/usecases/` — uma pasta própria, **fora** de `modules/`. Um
  usecase não pertence a um módulo específico porque, por definição, ele pode orquestrar mais de
  um; colocá-lo dentro de um módulo esconderia que aquele código cruza fronteira.
- Um usecase por operação/fluxo de negócio (ex: `create-pet.usecase.ts`, `report-listing.usecase.ts`),
  seguindo a mesma granularidade de responsabilidade única do conceito de Use Case em Clean
  Architecture.
- **Usecase (e rota) nunca faz `new XService()`/`new XRepository()`.** Services e repositories são
  instanciados uma única vez em `apps/api/src/app.ts` e decorados na instância raiz do Fastify
  (`app.identityService`, `app.identityRepository`, etc. — dependency injection via mecanismo nativo
  do Fastify, ver skill `dependency-injection`). O usecase recebe a instância do(s) service(s) como
  parâmetro, sourced de `app.<nomeDecorado>` por quem chama — a rota sempre tem `app` no escopo e é
  quem repassa a instância pro usecase.

**Alternativas consideradas:** usecase como camada adicional *depois* do service (`route → service
→ usecase → repository`) — rejeitado por criar duas camadas fazendo orquestração parecida, o que
tende a aumentar indireção em vez de reduzir acoplamento, o oposto do objetivo; usecase só entrando
quando a operação de fato cruza módulos (rota simples continuaria `route → service` direto) —
rejeitado em favor de uma regra única e consistente, mesmo pagando o custo de um wrapper fino em
operações que não orquestram nada; manter o service chamando o público de outro módulo em casos
"simples e estáveis" — rejeitado, porque abriria exceção à regra que justamente elimina o
acoplamento service-a-service.

**Verificado com base em:** o padrão de **Application Service / Orchestrator** por cima de
**Domain Service** em DDD/Clean Architecture — a camada de aplicação orquestra múltiplos domain
services para cumprir um fluxo de negócio completo, e handlers HTTP não devem orquestrar
diretamente; orquestração pertence à camada de aplicação, não à camada de transporte nem à camada
de domínio.

## Como aplicar

Ao implementar uma rota nova:
1. Crie (ou reutilize) o usecase da operação em `apps/api/src/usecases/<nome-da-operação>.usecase.ts`.
2. O usecase recebe o DTO de entrada (ver skill `dto`) e o(s) service(s) necessário(s) como
   parâmetro — nunca instanciando `new XService()` ele mesmo (ver skill `dependency-injection`) —,
   chama o(s) service(s) e devolve o resultado tipado como DTO.
3. A rota (skill `controller`) chama esse usecase, nunca um service diretamente, e é quem repassa
   pro usecase a instância do service lida de `app.<nomeDecorado>`.
4. O service continua só falando com o repository do seu próprio módulo — se durante a
   implementação um service parecer precisar chamar outro módulo, isso é sinal de que essa lógica
   pertence ao usecase, não ao service.

## Se algo não estiver coberto aqui

Isso indica uma decisão nova (ex: como o usecase lida com uma falha parcial ao orquestrar dois
services, se usecases podem chamar outros usecases, etc.). Não resolva sozinho — acione a skill
`pattern-advisor` para decidir isso com o usuário, e depois atualize esta skill com o resultado.
