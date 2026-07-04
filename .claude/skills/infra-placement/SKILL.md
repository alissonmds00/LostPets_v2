---
name: infra-placement
description: >
  Documenta a convenção já decidida neste projeto para decidir se um arquivo novo vai dentro de um
  módulo de domínio (`modules/<módulo>/`) ou em `infra/`. Use esta skill sempre que o usuário pedir
  para criar algo de natureza técnica (hashing, cliente de biblioteca externa, wrapper de SDK,
  helper de baixo nível) e não estiver claro onde colocar — ex: "isso é infra ou fica no módulo?",
  "onde eu boto esse helper de X", "cria um wrapper pra Y". Aplique a convenção documentada abaixo
  antes de escrever qualquer código; se a situação não estiver coberta por ela, não decida sozinho
  — acione a skill pattern-advisor para resolver a lacuna com o usuário.
---

# Infra placement (`infra/` vs dentro do módulo)

## Decisão (registrada em 2026-07-04)

- O critério pra algo morar em `infra/` é **ser técnico/plumbing de framework, sem significado de
  negócio** — não é "quantos módulos usam isso hoje". Um arquivo usado por um módulo só ainda
  assim vai pra `infra/` se ele não carrega nenhum conceito de domínio (ex: como fazer hash de
  senha, como instanciar o cliente do Prisma, como validar env vars) — esses são exatamente do
  mesmo tipo do que já mora em `infra/` hoje (`infra/db/prisma.ts`, `infra/config/env.ts`,
  `infra/errors/app-error.ts`, `infra/exception-handler.ts`).
- Contraponto: algo carrega significado de negócio (regra, conceito, decisão que faz sentido
  descrever pra um stakeholder do produto, não só pra outro programador) → fica dentro do módulo
  dono, mesmo que seja usado só ali. Contagem de uso não decide isso — o motivo de
  `requireAuth`/`requireRole` estarem em `infra/` (ver skill `auth-middleware`) não é "vários
  módulos usam", é "é middleware de request, tecnicamente cross-cutting" — mas o critério de fundo
  é o mesmo desta skill, generalizado aqui pra qualquer arquivo novo, não só middleware de auth.
- **Exemplo concreto aplicado:** `password.ts` (hash de senha via argon2) foi movido de
  `modules/identity/password.ts` para `infra/password.ts`. O motivo original pra ele ficar no
  módulo ("nenhum outro módulo usa isso ainda, YAGNI") usava o critério errado — contagem de uso.
  Hash de senha é tão técnico quanto o cliente do Prisma ou o carregamento de env: não tem
  significado de negócio próprio (não é uma regra de `identity`, é uma função criptográfica
  genérica), então pertence a `infra/` desde o início, independente de quantos módulos a chamam.
- Isso generaliza o que `ARCHITECTURE.md` já registra pra `infra/` ("camada técnica/de
  infraestrutura... não é módulo de domínio, não tem lógica de negócio") — esta skill só torna
  esse critério explícito e aplicável arquivo por arquivo, não só pastas inteiras.

**Alternativas consideradas:** decidir a localização por contagem de consumidores atuais
("só `identity` usa, então fica em `identity`") — rejeitado porque isso muda a decisão toda vez
que um segundo módulo passa a usar o mesmo helper técnico, forçando mover o arquivo depois; o
critério "tem significado de negócio ou não" já responde de forma estável desde a criação do
arquivo, sem depender de quem vai chamá-lo no futuro.

## Como aplicar

Ao criar um arquivo novo (helper, wrapper, utilitário):
1. Pergunte: isso descreve uma regra/conceito do negócio (perfil de usuário, anúncio, denúncia,
   mensagem) ou é plumbing técnico que faria sentido em qualquer projeto Node/Fastify (hash,
   client de banco, parsing de env, tratamento de erro genérico)?
2. Se for plumbing técnico → `apps/api/src/infra/<nome>.ts`, mesmo que só um módulo o consuma hoje.
3. Se for conceito de negócio → dentro do módulo dono, em `modules/<módulo>/<módulo>.<algo>.ts`
   (ver skills `dto`, `repository`, `service`, `controller`), mesmo que vários módulos venham a
   precisar dele — nesse caso a decisão é sobre **orquestração** (via usecase, ver skill
   `usecase`), não sobre mover o arquivo pra `infra/`.
4. Não decida com base em "quantos módulos usam isso hoje" — esse número muda; o critério de
   significado de negócio não.

## Se algo não estiver coberto aqui

Isso indica um caso ambíguo (ex: algo que parece técnico mas carrega uma regra de negócio
embutida, tipo validação de força de senha específica do produto). Não resolva sozinho — acione a
skill `pattern-advisor` para decidir isso com o usuário, e depois atualize esta skill com o
resultado.
