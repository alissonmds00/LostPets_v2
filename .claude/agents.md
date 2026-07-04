# Agents

Instruções para qualquer agente/subagent que for trabalhar neste repositório.

## Princípios de design (verificar sempre na fase de planejamento)

Todo plano de implementação — não só quando a skill `feature-development` é acionada, mas em
qualquer fase de planejamento (uso do Plan, um plano informal antes de codar, etc.) — deve ser
conferido contra três critérios antes de virar código:

- **Modularidade**: cada módulo só acessa suas próprias tabelas via seu próprio repository;
  comunicação entre módulos só via usecase.
- **Coesão**: cada camada (service, usecase, repository) faz uma coisa só e bem focada — nada de
  acumular responsabilidades que não são dela.
- **Coerência**: o plano segue os mesmos padrões já usados no resto do projeto (`route → usecase →
  service → repository`, DTO, erro, teste test-first) em vez de inventar um atalho novo.

Se o plano falhar em algum critério, refine antes de implementar. Ver o passo 3 da skill
`feature-development` (`.claude/skills/feature-development/`) para o checklist completo com
exemplos concretos desses três critérios aplicados a este projeto.

## Antes de implementar uma feature

Antes de implementar qualquer feature/funcionalidade nova, use a skill `feature-development`
(`.claude/skills/feature-development/`) primeiro. Ela analisa quais camadas a feature realmente
precisa (aplicando YAGNI/SRP) antes de acionar as skills de padrão específicas — isso evita tanto
criar camada demais "por garantia" quanto pular uma camada que a arquitetura já exige.

## Antes de criar um padrão de código

Antes de criar ou estruturar qualquer controller/route handler, repository, service, middleware,
DTO, validator, error handler, gateway, enum, logging/auditoria, documentação de API
(Swagger/OpenAPI) ou plugin de módulo — use a skill `pattern-advisor`
(`.claude/skills/pattern-advisor/`). Ela pesquisa a prática de mercado para essa stack, cruza com
as convenções já fixadas no projeto, e sempre pergunta ao usuário antes de implementar — nunca
decide sozinha.

Decisões de padrão já tomadas viram suas próprias skills em `.claude/skills/<padrão>/` (ex:
`.claude/skills/controller/`) — confira se já existe uma antes de reabrir uma discussão já
resolvida.

## Antes de implementar qualquer camada

Nenhuma camada (repository, service, usecase) é implementada sem um teste escrito antes — ver a
skill `testing` pro ciclo red→green obrigatório.

## Ao concluir uma tarefa

Toda tarefa atômica (feature ou decisão de padrão) termina com uma PR aberta pelo agente/subagent
— nunca commit direto em `main`, e o agente nunca faz o merge sozinho. Ver a skill `git-workflow`
(`.claude/skills/git-workflow/`) para a convenção de branch/commit/PR e o critério do que conta
como "atômico".
