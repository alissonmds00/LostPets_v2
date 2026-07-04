---
name: dto
description: >
  Documenta a convenção já decidida neste projeto para DTOs (Data Transfer Objects). Use esta
  skill sempre que o usuário pedir para criar, tipar ou revisar a forma dos dados que trafegam
  entre camadas — ex: "cria um DTO pra X", "como eu tipo o retorno desse service", "qual tipo eu
  uso no repository pra Y". Aplique a convenção documentada abaixo antes de escrever qualquer
  código; se a situação não estiver coberta por ela, não decida sozinho — acione a skill
  pattern-advisor para resolver a lacuna com o usuário.
---

# DTO (Data Transfer Object)

## Decisão (registrada em 2026-07-03)

- Todo DTO é um tipo derivado via `z.infer<typeof schema>` do schema Zod correspondente em
  `schemas.ts` — nunca uma interface/type escrita à mão duplicando o formato do schema.
- Cada módulo tem **um único arquivo** `<módulo>.dto.ts` (ex: `pets.dto.ts`) com todos os DTOs
  daquele módulo juntos — não um arquivo por operação.
- **Todas as camadas usam o DTO, não o schema Zod diretamente nem o tipo gerado pelo Prisma** —
  rota, usecase, service e repository importam de `<módulo>.dto.ts`. O repository também é tipado
  com o DTO, não com `Prisma.XCreateInput`/tipo do model gerado.
- **Gateways também podem ter schema + DTO** (ver skill `gateway`), seguindo a mesma lógica: um
  `<serviço>.schemas.ts` + `<serviço>.dto.ts` por gateway em `apps/api/src/gateways/` — não um
  arquivo compartilhado entre todos os gateways, já que cada um encapsula um sistema externo
  diferente (não são um "módulo" único como `pets`/`identity`).
- Convenção de nome: PascalCase com sufixo `Dto` (`CreatePetDto`, `UpdatePetDto`,
  `PetResponseDto`).

**Alternativas consideradas:** repository usando tipos do Prisma, com o service convertendo
DTO ↔ formato Prisma (rejeitado — adiciona uma conversão a mais; a isolação que isso traria só
importa se o formato da API e o da tabela divergirem de fato, o que ainda não é um problema real
neste projeto); um arquivo `.dto.ts` por operação em vez de um por módulo (rejeitado — mais
arquivos pra navegar, e já foi decidido manter `schemas.ts` agrupado por módulo, então o `dto.ts`
segue a mesma lógica de agrupamento).

**Trade-off consciente:** como o repository também é tipado pelo DTO (não pelo Prisma), se a forma
da API divergir da forma da tabela no futuro (campo calculado, campo opcional de um lado só etc.),
essa divergência aparece direto no repository, sem uma camada de conversão isolando isso. Foi uma
escolha deliberada pela simplicidade agora — se aparecer um caso concreto de divergência, isso é
motivo pra reabrir esta decisão com a skill `pattern-advisor`, não pra resolver informalmente ali.

**Verificado com base em:** o padrão `export const xSchema = z.object({...}); export type XDto =
z.infer<typeof xSchema>` é a forma documentada de extrair tipos de schemas Zod sem duplicar a
definição manualmente — fonte: discussões e exemplos da comunidade Zod/TypeScript sobre extração
de tipo via `z.infer`.

## Como aplicar

Ao criar ou alterar uma rota que recebe/retorna dados:
1. Defina (ou reutilize) o schema Zod em `schemas.ts` do módulo.
2. Em `<módulo>.dto.ts`, exporte o tipo: `export type CreatePetDto = z.infer<typeof createPetSchema>;`.
3. A rota, o usecase, o service e o repository importam o DTO de `<módulo>.dto.ts` — nenhum deles
   importa o schema Zod em si (isso fica reservado pra validação/serialização na camada de rota)
   nem o tipo gerado pelo Prisma.

## Se algo não estiver coberto aqui

Isso indica uma decisão nova, não uma extensão óbvia desta (ex: um DTO que não deriva de nenhum
schema existente, ou um caso real de divergência entre forma da API e forma da tabela). Não
resolva sozinho — acione a skill `pattern-advisor` para decidir isso com o usuário, e depois
atualize esta skill com o resultado.
