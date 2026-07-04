---
name: git-workflow
description: >
  Documenta a convenção já decidida neste projeto para branches, commits e PRs. Use esta skill
  sempre que uma tarefa (feature, decisão de padrão, correção) estiver concluída e pronta pra virar
  código versionado, ou quando o usuário perguntar sobre fluxo de branch/commit/PR. Toda tarefa
  atômica termina com uma PR aberta — nunca commit direto em main. Aplique a convenção abaixo antes
  de abrir uma PR; se a situação não estiver coberta por ela, não decida sozinho — acione a skill
  pattern-advisor para resolver a lacuna com o usuário.
---

# Git workflow (branch, commit, PR)

## Decisão (registrada em 2026-07-03)

- **Toda tarefa atômica termina com uma PR aberta pelo agente/subagent** — nunca fica commitada
  direto em `main`.
- **O agente só abre a PR, nunca faz o merge.** Merge em `main` é decisão do usuário — não há CI
  configurado neste repositório ainda, então nada barra um erro antes de chegar em `main` a não ser
  a revisão humana.
- **Branch por tarefa**, nome no formato `(frontend|backend)/(tipo)/nome-da-feature` — ex:
  `backend/feat/pets-create-listing`, `backend/chore/swagger-docs`, `frontend/fix/login-form`. O
  `tipo` segue o mesmo prefixo do commit semântico (`feat`, `fix`, `chore`, `refactor`, `docs`,
  `test`); a área (`frontend`/`backend`) indica qual workspace a tarefa toca predominantemente.
- **PR sempre contra `main`** (único branch de integração deste repositório).
- **O que conta como "tarefa atômica"** — a menor unidade de trabalho que é revisável e
  independente das outras:
  - Feature de negócio: a fatia vertical completa de um usecase (repository + service + usecase +
    rota + testes — ver skill `feature-development`). Não abra uma PR por camada isolada
    (repository sozinho, depois service sozinho) — isso geraria PRs com dependência de merge entre
    si, contradizendo "independentes".
  - Decisão de padrão/arquitetura (via `pattern-advisor`): a decisão em si + a skill registrada
    que a documenta, nada além disso na mesma PR.
  - Não empacote duas features ou duas decisões não relacionadas na mesma PR, mesmo que pareçam
    pequenas — PRs enxutas valem mais que PRs "aproveitando a viagem".

**Exceção tratada nesta data:** o volume de mudanças feito antes desta regra existir (migração de
`gateway`, `enum`, `exception-handler`, `swagger`, e todas as skills em `.claude/`) virou uma única
PR de catálogo retroativa, não porque seja o padrão, mas porque separar isso em pedaços depois do
fato custaria mais do que o benefício. A partir dessa PR, a regra vale tarefa por tarefa.

## Como aplicar

Ao concluir uma tarefa atômica:
1. Antes de começar, crie a branch a partir de `main`: `git checkout -b <area>/<tipo>/<nome>`.
2. Implemente só o que essa tarefa cobre — se no meio do caminho aparecer trabalho fora do escopo
   original, isso é sinal de que virou duas tarefas: termine a atual, abra PR, e trate o resto como
   uma tarefa nova (branch e PR próprias).
3. Commits semânticos (`feat: ...`, `chore: ...`, `fix: ...`), mesmo prefixo da branch.
4. `git push` da branch e `gh pr create` com título curto e descrição resumindo o que foi feito e
   por quê — e pare aí. Não dar merge, mesmo que os testes estejam verdes.

## Se algo não estiver coberto aqui

Isso indica uma decisão nova (ex: exigir CI antes de abrir a PR, squash vs merge commit ao
mergear, convenção pra hotfix). Não resolva sozinho — acione a skill `pattern-advisor` para
decidir isso com o usuário, e depois atualize esta skill com o resultado.
