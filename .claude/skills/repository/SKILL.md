---
name: repository
description: >
  Documenta a convenção já decidida neste projeto para a camada de repository (acesso a dado via
  Prisma). Use esta skill sempre que o usuário pedir para criar, estruturar ou revisar acesso a
  dado de um módulo — ex: "cria o repository de X", "como eu busco Y no banco", "qual query eu uso
  pra Z". Aplique a convenção documentada abaixo antes de escrever qualquer código; se a situação
  não estiver coberta por ela, não decida sozinho — acione a skill pattern-advisor para resolver a
  lacuna com o usuário.
---

# Repository

## Decisão (registrada em 2026-07-03)

- O repository é o **único ponto do módulo que fala com o Prisma** — nenhuma outra camada
  (rota, usecase, service, gateway) importa o `PrismaClient` ou um tipo gerado por ele.
- Cada módulo acessa só suas próprias tabelas, através do seu próprio repository — nunca uma query
  cross-module (ver regra dura em [ARCHITECTURE.md](../../../ARCHITECTURE.md)).
- Repository não tem regra de negócio — só monta a query, executa, e devolve o dado. Regra de
  negócio é sempre do service (ver skill `service`), que é quem chama o repository.
- Entrada e saída do repository são tipadas como DTO (ver skill `dto`), nunca como o tipo gerado
  pelo Prisma (`Prisma.XCreateInput`, etc.) — o repository converte internamente entre o DTO e o
  formato que o Prisma espera.
- **Convenção de not-found, por nome do método:**
  - `findX` (ex: `findByEmail`) — a busca pode legitimamente não achar nada; retorna `null`. Usado
    quando "não achou" é um resultado válido, não um erro (ex: checar se um e-mail já está em
    uso).
  - `getX` (ex: `getById`) — quem chama já assume que o registro deveria existir; lança
    `NotFoundError` (`infra/errors`) se não achar, em vez de devolver `null`.
- **Erros específicos do Prisma são traduzidos aqui, nunca vazam pra fora.** Ex: capturar
  `PrismaClientKnownRequestError` com `code === 'P2002'` (violação de unique constraint) e lançar
  um `ConflictError` (`infra/errors`) no lugar. Isso é consequência direta da regra acima — se o
  service precisasse tratar um erro do Prisma, ele estaria conhecendo o Prisma, o que quebraria "só
  o repository fala com o Prisma".
- Convenção de nome: `<módulo>.repository.ts`, classe `<Módulo>Repository`.

**Alternativas consideradas:** repository sempre retornando `null` em qualquer busca sem achar
(rejeitado — obriga toda chamada a checar `null`, mesmo quando o chamador já assume que o registro
existe); repository sempre lançando `NotFoundError` (rejeitado — atrapalha casos onde "não achou"
é uma resposta válida, tipo checar disponibilidade de e-mail).

**Verificado com base em:** a prática documentada de capturar `PrismaClientKnownRequestError` e
checar `error.code` (`P2002` = unique constraint) pra traduzir em um erro específico do domínio, em
vez de deixar o erro cru do Prisma vazar pra cima — fonte: documentação oficial do Prisma sobre
tratamento de exceções.

## Como aplicar

Ao criar ou alterar acesso a dado de um módulo:
1. Escreva o método no `<módulo>.repository.ts`, tipado com o DTO correspondente na entrada e na
   saída.
2. Escolha `findX`/`getX` conforme o chamador espera que o registro possa ou não existir.
3. Envolva a chamada ao Prisma em `try/catch` quando o método puder falhar por uma constraint do
   banco (unique, foreign key), e traduza pro `AppError` correspondente antes de propagar.
4. O service chama o repository — a rota, o usecase e o gateway nunca o importam diretamente.

## Se algo não estiver coberto aqui

Isso indica uma decisão nova (ex: uma query que precisa de transação entre múltiplas tabelas do
mesmo módulo, paginação/filtro complexo o suficiente pra virar sua própria decisão). Não resolva
sozinho — acione a skill `pattern-advisor` para decidir isso com o usuário, e depois atualize esta
skill com o resultado.
