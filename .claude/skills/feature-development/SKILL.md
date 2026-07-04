---
name: feature-development
description: >
  Passo obrigatório ANTES de implementar qualquer feature ou funcionalidade nova neste projeto —
  analisa quais camadas (usecase, service, repository, gateway, dto, enum, exception) a feature
  realmente precisa, aplicando YAGNI e SRP, antes de acionar as skills de padrão específicas pra
  cada uma. Use esta skill sempre que o usuário pedir pra implementar, construir ou adicionar uma
  feature/funcionalidade/fluxo completo (ex: "implementa o cadastro de pet", "adiciona a
  funcionalidade de denúncia", "constrói o fluxo de X") — não só quando ele pede uma camada
  isolada (nesse caso, vá direto na skill do padrão específico, ex: `controller`, `usecase`).
  Dispare isso ANTES de qualquer skill de padrão específica, mesmo que a feature pareça simples.
---

# Feature development

## Por que essa skill existe

As skills de padrão (`controller`, `usecase`, `service`, `repository`, `gateway`, `dto`, `enum`,
`exception-handler`) já dizem **como** implementar cada camada, mas não dizem **quais** camadas
uma feature específica realmente precisa. Sem esse passo, dois erros ficam fáceis de cometer: criar
camada demais "por garantia" (um gateway pra algo que não é externo, um enum pra um valor que já
cabia num booleano, uma subclasse de erro nova pra um caso que um genérico já cobre — violação de
YAGNI) ou faltar uma camada que a arquitetura já exige (pular o usecase, por exemplo). Esta skill é
o passo de análise que vem antes de tocar em qualquer skill de padrão.

## Fluxo

### 1. Identifique a operação de negócio e o(s) módulo(s) envolvidos

Uma feature corresponde a um usecase (ver skill `usecase`) — identifique o nome da operação e quais
módulos ela toca. Se tocar mais de um módulo, isso só confirma o que já é regra: o usecase
orquestra os services envolvidos, nenhum service chama outro direto.

### 2. Para cada camada possível, decida NOVO vs REAPROVEITA — sempre com YAGNI

Não crie uma camada porque "pode ser útil depois". Crie só o que essa operação específica exige
agora:

- **Usecase:** normalmente novo — um usecase por operação de negócio (ver skill `usecase`).
  Reaproveita um existente só se for literalmente a mesma operação.
- **Service:** o módulo já tem service? Ele já cobre essa regra de negócio com um método
  existente, ou precisa de um método novo? Nunca crie um segundo service pro mesmo módulo (a skill
  `service` já fixa isso — coesão, um só por módulo).
- **Repository:** mesma lógica — método novo só se nenhuma query existente já serve.
  Não pré-otimize com métodos genéricos "pra usar depois".
- **Gateway:** só se a feature genuinamente chama um sistema externo de verdade. Não crie uma
  camada de integração para algo que ainda é 100% interno.
- **DTO:** estenda o `<módulo>.dto.ts` já existente com o(s) tipo(s) novo(s) — não crie um arquivo
  de DTO por operação (a skill `dto` já fixa um arquivo por módulo).
- **Enum:** só se o campo é genuinamente um novo conjunto fechado de valores que nenhum enum
  existente já cobre. Não crie um enum pra um valor que cabe num booleano ou que já é coberto por
  um enum existente (ex: reaproveitar `Role` em vez de criar um enum de permissão paralelo).
- **Erro:** um `AppError` genérico existente com mensagem customizada resolve? Use-o. Só crie uma
  subclasse nova em `modules/<módulo>/errors.ts` quando a regra de negócio for específica o
  suficiente pra merecer um `code` próprio (ver skill `exception-handler`).

### 3. Verifique modularidade, coesão e coerência no plano — e refine antes de implementar

Antes de sair implementando o que saiu do passo 2, confira o plano contra os três critérios abaixo.
Se algum falhar, refine o plano (troque a camada, junte/separe responsabilidade, ajuste o módulo
dono) antes de escrever qualquer código — não é um passo opcional nem uma formalidade:

- **Modularidade** — o plano respeita que cada módulo só mexe nas próprias tabelas via seu próprio
  repository, e que qualquer comunicação entre módulos passa pelo usecase (nunca service chamando
  service de outro módulo)? Se a feature parece exigir que um módulo "veja direto" a tabela de
  outro, o desenho está errado — o usecase deve orquestrar, não a camada de dados vazar fronteira.
- **Coesão** — cada camada nova ou reaproveitada faz *uma coisa só*? Um service ganhando um método
  que não tem nada a ver com a responsabilidade do módulo, um usecase fazendo duas operações de
  negócio diferentes, um repository expondo uma query genérica demais "pra servir vários casos" —
  tudo isso é sinal de baixa coesão. Divida em vez de acumular.
- **Coerência** — o plano segue os mesmos padrões já usados no resto do projeto (mesma ordem de
  camadas `route → usecase → service → repository`, mesma convenção de DTO, mesmo padrão de erro,
  mesma ordem de teste test-first)? Se a feature "resolve" algo criando um atalho que nenhum outro
  módulo usa (ex: rota chamando service direto, validação solta fora do schema), isso quebra
  coerência mesmo que funcione — alinhe com o padrão existente em vez de inventar um novo.

Esse é o mesmo motivo do passo 2 usar YAGNI: os dois filtros trabalham juntos (YAGNI corta o que
não precisa existir; esses três critérios garantem que o que sobra está bem desenhado). Se o plano
não passa em algum critério só de reorganizar (sem abrir uma decisão de padrão nova), ajuste e
segue. Se o problema só se resolve com uma decisão de padrão que ainda não existe, isso cai no
passo 5, abaixo.

### 4. Implemente na ordem test-first, camada por camada

Sem apresentar esse plano como checkpoint — a análise e verificação acima são internas, não
precisam de confirmação antes de começar (skills de padrão específicas continuam parando pra
perguntar quando *elas* identificarem uma decisão genuinamente em aberto, isso não muda). Siga a
ordem já fixada na skill `testing`: teste de repository → repository → teste de service → service →
teste de usecase → usecase/rota.

### 5. Se uma camada não tem convenção decidida ainda, ou surge uma sub-decisão nova

Não invente. Acione a skill `pattern-advisor` pra essa camada específica antes de continuar — essa
regra não muda só porque agora existe um passo de análise antes.

### 6. Mantenha coeso e conciso (SRP) durante a implementação

Um usecase faz exatamente uma operação de negócio; um service só contém regra do seu próprio
módulo; um repository só expõe as queries que esse módulo realmente usa. Resista à tentação de
adicionar um parâmetro "por garantia", uma flag de config, ou uma abstração que essa feature
específica ainda não pede — isso é exatamente o oposto do que YAGNI e SRP quer dizer aqui.

## Se algo não estiver coberto aqui

Isso indica uma decisão de processo nova (ex: como priorizar entre duas camadas que parecem
igualmente necessárias, ou um caso onde nenhuma skill de padrão existente cobre a camada
identificada). Não resolva sozinho — acione a skill `pattern-advisor`, e depois atualize esta skill
com o resultado.
