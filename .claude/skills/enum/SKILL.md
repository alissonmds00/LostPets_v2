---
name: enum
description: >
  Documenta a convenção já decidida neste projeto para representar valores finitos (status, papel,
  tipo, categoria) como enum, em vez de string ou número soltos no código. Use esta skill sempre
  que o usuário pedir para criar um campo com um conjunto fechado de valores possíveis, ou revisar
  se um valor "mágico" (string/número solto) deveria virar enum — ex: "cria o status de X", "que
  valores esse campo pode ter", "isso devia ser um enum?". Aplique a convenção documentada abaixo
  antes de escrever qualquer código; se a situação não estiver coberta por ela, não decida sozinho
  — acione a skill pattern-advisor para resolver a lacuna com o usuário.
---

# Enum

## Decisão (registrada em 2026-07-03)

- Todo valor finito (status, papel, tipo, categoria) é um **enum**, nunca uma string ou número
  solto espalhado pelo código (`"active"`, `1`, etc.).
- Os valores do enum são **por extenso** — `ACTIVE`, `PENDING_REVIEW`, não abreviações ou códigos
  (`A`, `PND`) nem números mágicos (`0`, `1`, `2`). O valor tem que ser legível sozinho, sem
  precisar consultar uma tabela de significado.
- **Localização:** enum usado por mais de um módulo (ex: `Role`, referenciado em checagem de
  permissão em vários lugares) fica em `shared/enums/<nome>.enum.ts`. Enum usado por um módulo só
  (ex: status de um `PetListing`) fica dentro do próprio módulo (`modules/<módulo>/<nome>.enum.ts`)
  — não centraliza em `shared/` o que não é, de fato, compartilhado.
- **Fonte da verdade, quando o valor é persistido no banco:** se o enum corresponde a uma coluna
  do Prisma, ele **já existe** como `enum` no `schema.prisma` (Prisma exige isso pra tipar a
  coluna). Nesse caso, o resto da aplicação **reaproveita o enum gerado pelo Prisma** via
  `z.nativeEnum(NomeDoEnum)` importado de `@prisma/client` — não redeclara os mesmos valores de
  novo em outro arquivo.
  - **Isso é uma exceção consciente** à regra "só o repository fala com o Prisma": aqui a exceção
    vale só pra **tipos de enum** (não para models, queries ou o `PrismaClient` em si), porque
    duplicar os valores em dois lugares (schema.prisma e um arquivo à parte) criaria risco real de
    divergência silenciosa se alguém atualizar um e esquecer o outro.
  - Pra não espalhar `import { X } from '@prisma/client'` em cada schema/DTO que precisa do enum,
    essa exceção fica **centralizada num único arquivo wrapper** por enum — o mesmo
    `<nome>.enum.ts` da localização acima re-exporta o enum do Prisma e a versão Zod dele. Ex:
    [`shared/enums/role.enum.ts`](../../../apps/api/src/shared/enums/role.enum.ts):
    ```ts
    import { Role } from '@prisma/client';
    import { z } from 'zod';
    export { Role };
    export const RoleSchema = z.nativeEnum(Role);
    ```
    O resto da aplicação importa `Role`/`RoleSchema` desse arquivo, nunca de `@prisma/client`
    diretamente — assim a exceção fica visível e contida num único lugar por enum.
- **Fonte da verdade, quando o valor NÃO é persistido no banco** (constante de aplicação que não é
  coluna de tabela nenhuma): declarado com `z.enum([...] as const)`, seguindo o mesmo padrão já
  usado pros DTOs (`z.infer` pra extrair o tipo TS) — não um `enum` nativo do TypeScript.
- Convenção de nome de arquivo: `<nome>.enum.ts`.

**Alternativas consideradas:** `enum` nativo do TypeScript em vez de `z.enum` (rejeitado —
inconsistente com o resto do projeto, que já usa Zod como fonte de verdade em tudo; `enum` nativo
não se integra direto com validação Zod sem `z.nativeEnum` por cima, e tem particularidades
conhecidas do TS que o projeto prefere evitar); redeclarar os enums persistidos em `shared/` em vez
de reaproveitar o do Prisma (rejeitado — cria dois lugares pra manter sincronizados à mão, risco
real de divergência); centralizar todo enum em `shared/` independente de quantos módulos usam
(rejeitado — contraria a fronteira de módulo já estabelecida nas outras skills).

**Verificado com base em:** a prática documentada de reaproveitar o enum gerado pelo Prisma via
`z.nativeEnum()` em vez de duplicar a mesma lista de valores em Zod — evita os dois lugares
divergirem com o tempo.

## Como aplicar

Ao adicionar um campo com valores finitos:
1. Pergunte primeiro: esse valor vai virar uma coluna no banco? Se sim, declare o `enum` no
   `schema.prisma` (valores por extenso) e reaproveite-o via `z.nativeEnum()` nos schemas/DTOs que
   precisarem dele. Se não, declare com `z.enum([...] as const)` direto.
2. Decida a pasta: mais de um módulo usa esse enum? Vai pra `shared/enums/`. Só um módulo usa? Fica
   dentro da pasta desse módulo.
3. Nunca compare contra a string/número cru no código (`if (status === 'active')`) — sempre contra
   o enum (`if (status === PetStatus.ACTIVE)` ou equivalente).

## Se algo não estiver coberto aqui

Isso indica uma decisão nova (ex: um enum que começa em um módulo só e depois passa a ser usado por
outro — quando promover de local pra `shared/`). Não resolva sozinho — acione a skill
`pattern-advisor` para decidir isso com o usuário, e depois atualize esta skill com o resultado.
