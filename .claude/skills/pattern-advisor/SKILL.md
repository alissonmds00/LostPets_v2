---
name: pattern-advisor
description: >
  Conduz uma entrevista antes de implementar qualquer padrão de projeto/arquitetura reconhecível
  neste repositório — controller/route handler, repository, service, middleware, DTO, validator,
  error handler, plugin de módulo, etc. Levanta a stack real do projeto (Fastify, Prisma, Zod,
  TypeScript), pesquisa como a comunidade implementa aquele padrão especificamente nessa stack,
  cruza isso com as convenções já documentadas do projeto (ARCHITECTURE.md, CLAUDE.md, PLAN.md,
  código existente) e apresenta as opções com o trade-off central de cada uma — mas NUNCA escolhe
  nem implementa sozinha. Use esta skill SEMPRE que o usuário pedir para criar/estruturar algo que
  corresponde a um padrão conhecido (ex: "cria uma controller pra pets", "cria um repository de
  usuários", "monta um middleware de auth", "como eu faço um DTO aqui", "adiciona uma camada de
  validação"), mesmo que ele não use a palavra "padrão" ou "pattern" explicitamente — inclusive
  quando o pedido usa terminologia de outro framework que não existe literalmente neste projeto
  (ex: "controller" num projeto Fastify que só tem route→service→repository). Dispare também
  quando o usuário pedir para revisar se um código já existente segue as convenções do projeto.
---

# Pattern Advisor

## Por que essa skill existe

O usuário está aprendendo arquitetura modular em Node/TS através deste projeto de portfólio. O
objetivo dele não é ter código funcionando o mais rápido possível — é entender as alternativas,
ver o trade-off, e decidir conscientemente. Por isso esta skill nunca decide por ele: ela pesquisa,
organiza a decisão em blocos pequenos, e pergunta. Se em algum momento parecer mais rápido "só
escolher a opção óbvia e seguir", isso é exatamente o comportamento que essa skill existe para
evitar.

## Fluxo (não pule etapas, não implemente antes do fim)

### 1. Identifique o padrão e o contexto

Que padrão foi pedido (controller, repository, DTO, middleware...) e em qual módulo/contexto
(`identity`, `pets`, `messaging`, `moderation`, `shared`)? Se o pedido for ambíguo sobre o módulo
ou o escopo, pergunte antes de prosseguir — não assuma.

### 2. Veja se essa decisão já foi tomada antes

Cada padrão decidido vira sua própria skill em `.claude/skills/<padrão>/SKILL.md` (ver seção
"Registrando a decisão" abaixo). Procure primeiro por uma skill com esse nome ou objetivo
equivalente. Se já existe:
- Cite a decisão documentada nela e por que foi tomada.
- Pergunte só se o usuário quer segui-la de novo ou reabrir a discussão — não repita a entrevista
  inteira do zero para o mesmo padrão já decidido.
- Se for reabrir, o passo 8 atualiza essa mesma skill em vez de criar uma nova.

Se não existe nenhuma skill pra esse padrão ainda, siga para o passo 3.

### 3. Levante a stack real do projeto

Leia o que existe de verdade, não confie em memória de conversas anteriores (a stack muda):
`package.json` (raiz e do app relevante), `CLAUDE.md`, `ARCHITECTURE.md`, `PLAN.md`, e o código já
escrito no módulo em questão (`apps/api/src/modules/<módulo>`, `apps/api/src/shared`). Isso te dá
o framework HTTP, ORM, lib de validação, convenções de erro, etc. de fato em uso — não a opção
"padrão de mercado" para uma stack genérica.

### 4. Pesquise a prática de mercado PARA ESSA STACK específica

Use busca web focada na combinação real (ex: "repository pattern Prisma TypeScript", não
"repository pattern" genérico; "Fastify route handler vs controller layer", não "MVC controller
best practices"). Prefira fontes atuais — documentação oficial do framework/lib, discussões
recentes da comunidade — a posts antigos ou genéricos de outra stack. O objetivo aqui é trazer
opções reais que alguém usando essa stack hoje consideraria, não uma lista abstrata de padrões de
livro.

### 5. Cruze mercado x convenções do projeto

Releia as regras já explícitas do projeto antes de formular as perguntas — em especial:
- Fronteira de módulo: cada módulo só acessa suas próprias tabelas via seu próprio repositório;
  comunicação entre módulos é sempre via serviço público exportado do outro módulo.
- Camadas `route → service → repository`; repositório é o único ponto que fala com o Prisma.
- Formato de erro padronizado `{ error: { code, message, details? } }` via `AppError`.
- Validação com Zod integrada ao Fastify (`fastify-type-provider-zod`).

Se a prática de mercado pesquisada colide com uma regra já fixada no projeto, isso não é uma
pergunta em aberto — é um fato a comunicar. Ex: "a comunidade Express costuma usar uma camada de
controller separada da rota, mas esse projeto já decidiu que a rota Fastify chama o service
direto — quer manter essa convenção aqui também ou isso é um caso pra reabrir?" Só transforme em
pergunta de fato o que ainda está genuinamente em aberto.

### 6. Apresente as opções com o AskUserQuestion, uma decisão por vez

Quando houver uma decisão real em aberto, use a ferramenta **AskUserQuestion** — é exatamente o
caso de uso dela: uma escolha que é do usuário, não sua. Regras:
- **Uma decisão por pergunta.** Se resolver uma decisão abre uma sub-decisão nova (ex: "controller
  fino" decidido, mas falta decidir onde valida o Zod schema), pergunte a sub-decisão depois,
  separadamente — não empilhe tudo de uma vez.
- Cada opção precisa deixar claro o **trade-off central** em uma frase — não uma lista exaustiva de
  prós/contras, só o que realmente pesa na escolha.
- Não crie uma pergunta para algo que já é ditado por uma regra hard do projeto (passo 5) — isso é
  informação, não pergunta.
- Nunca escreva/edite código de implementação antes do usuário responder a(s) pergunta(s)
  necessária(s). Ler arquivos, pesquisar e perguntar não precisa de aprovação prévia; escrever
  código sim.

### 7. Implemente exatamente o que foi decidido

Sem adicionar camadas, abstrações ou variações que não foram discutidas — se durante a
implementação aparecer mais uma decisão em aberto, pare e pergunte, não resolva sozinho "no
caminho".

### 8. Registre a decisão como uma skill nova

Depois de implementado, crie (ou atualize, se estava reabrindo) a skill desse padrão em
`.claude/skills/<padrão>/SKILL.md` (ver próxima seção) — é isso que evita repetir a entrevista da
próxima vez que esse padrão aparecer.

## Registrando a decisão como skill

Cada padrão decidido (controller, repository, middleware, DTO...) vira sua própria skill em
`.claude/skills/<slug-do-padrão>/SKILL.md` — não uma entrada de markdown solta em ARCHITECTURE.md
ou num arquivo de notas. O motivo: essa skill nova passa a disparar sozinha da próxima vez que
alguém pedir esse padrão, lembrando a convenção antes de qualquer código ser escrito, sem depender
de alguém lembrar de ler um arquivo à parte.

`<slug-do-padrão>` é o nome do padrão em kebab-case (`controller`, `repository`,
`auth-middleware`) — não amarrado a um módulo específico, já que a convenção decidida normalmente
vale pro projeto inteiro. Se um módulo específico precisar de uma exceção genuína à convenção
geral, documente essa exceção dentro da mesma skill, numa seção separada, em vez de criar uma
skill por módulo.

Estrutura da skill do padrão:

```markdown
---
name: <slug-do-padrão>
description: >
  Documenta a convenção já decidida neste projeto para <padrão>. Use sempre que o usuário pedir
  para criar/estruturar/revisar algo equivalente a <padrão> (liste aqui as variações de fraseado
  observadas). Aplique a convenção abaixo antes de escrever código; se a situação não estiver
  coberta por ela, não decida sozinho — acione a skill pattern-advisor.
---

# <Nome do padrão>

## Decisão (registrada em <data>)
<o que foi escolhido, em frases diretas — o suficiente pra alguém aplicar sem reler a pesquisa>

**Alternativas consideradas:** <opções apresentadas e por que não foram escolhidas>

## Como aplicar
<passos concretos de como usar essa convenção ao implementar algo desse padrão>

## Se algo não estiver coberto aqui
Isso é uma decisão nova, não uma extensão óbvia desta. Não resolva sozinho — acione a skill
`pattern-advisor` para decidir com o usuário, e depois atualize esta skill com o resultado.
```

Isso faz da skill do padrão uma segunda linha de defesa contra decisão silenciosa: mesmo sem o
pattern-advisor no meio, ela recusa resolver algo fora do que já foi decidido.

## Exemplo completo

**Pedido:** "cria uma controller pra listar os pets"

1. Padrão = controller/route handler. Contexto = módulo `pets`.
2. Sem decisão registrada ainda para "controller" neste projeto.
3. Leitura da stack: Fastify 5 + `fastify-type-provider-zod`, camadas já documentadas como
   `route → service → repository`, `infra/errors` com `AppError`.
4. Pesquisa: como projetos Fastify+TS estruturam a camada de entrada HTTP — a maioria não usa uma
   camada "controller" separada da definição da rota (diferente de Nest/Express+MVC); a rota já
   registra o schema Zod e chama o service diretamente.
5. Cruzamento: o projeto já decidiu `route → service → repository` em `ARCHITECTURE.md` — isso não
   deixa espaço para uma camada de controller adicional sem contradizer uma regra já fixada. Isso
   vira comunicação, não pergunta: "esse projeto não tem uma camada de controller separada — a
   rota Fastify com schema Zod já cumpre esse papel e chama o service direto. Quer manter assim ou
   isso é um caso concreto pra você querer introduzir uma camada nova? Se for pra manter, a real
   decisão em aberto é onde a paginação/filtros da listagem são resolvidos: no service ou no
   repository."
6. Pergunta real via AskUserQuestion: "Onde deve morar a lógica de paginação/filtro da listagem de
   pets?" com opções tipo "No repository (query já sai pronta)" vs "No service (repository só
   recebe params, mais fácil de testar isolado)", cada uma com o trade-off em uma frase.
7. Só depois da resposta, implementar a rota + service (+ repository se ainda não existir) do jeito
   decidido.
8. Criar `.claude/skills/controller/SKILL.md`: "sem camada de controller separada, rota chama
   service direto; paginação/filtro resolvidos em `<local escolhido>`" — daí em diante, pedir uma
   controller de novo dispara essa skill nova em vez do pattern-advisor do zero.
