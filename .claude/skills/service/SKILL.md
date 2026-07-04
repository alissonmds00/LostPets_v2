---
name: service
description: >
  Documenta a convenção já decidida neste projeto para a camada de service (regra de negócio por
  módulo). Use esta skill sempre que o usuário pedir para criar, estruturar ou revisar a lógica de
  negócio de um módulo — ex: "cria o service de X", "onde fica a regra de validação de Y", "como o
  módulo Z trata isso". Aplique a convenção documentada abaixo antes de escrever qualquer código;
  se a situação não estiver coberta por ela, não decida sozinho — acione a skill pattern-advisor
  para resolver a lacuna com o usuário.
---

# Service

## Decisão (registrada em 2026-07-03)

- Cada módulo tem **um único service coeso** (ex: `PetsService`) — não fragmente a lógica de um
  módulo em vários services menores. Se um módulo cresce muito, isso é sinal de repensar se ele
  ainda é um módulo só, não de dividir o service.
- O service **nunca** chama o service de outro módulo — nenhuma exceção, nem em casos "simples e
  estáveis". Qualquer operação que precise de mais de um módulo é responsabilidade do usecase (ver
  skill `usecase`), nunca do service chamando outro service diretamente.
- O service é quem chama o repository do **próprio** módulo e efetua as regras de negócio da
  operação (validação de domínio, cálculo, decisão) — o repository só faz acesso a dado, sem regra
  de negócio nele.
- Entrada e saída do service são tipadas como DTO (ver skill `dto`), nunca como o schema Zod
  diretamente nem como o tipo gerado pelo Prisma.
- Erros de regra de negócio são lançados como subclasses de `AppError` (`infra/errors`) — nunca
  um erro genérico ou um formato de retorno próprio.

**Alternativas consideradas:** service podendo chamar o service de outro módulo em casos pontuais
(rejeitado ao decidir a skill `usecase` — abriria exceção à regra que existe justamente pra
eliminar acoplamento service-a-service); múltiplos services por módulo divididos por
sub-responsabilidade (rejeitado — contraria a coesão pedida; fragmentar a lógica de um módulo em
vários services tende a espalhar regra de negócio relacionada em lugares diferentes sem necessidade
real ainda).

## Como aplicar

Ao implementar ou alterar a lógica de negócio de um módulo:
1. Toda a regra de negócio daquele módulo entra no service único do módulo — não crie um segundo
   service "auxiliar" pro mesmo módulo.
2. O service recebe e devolve DTOs, chama o repository do próprio módulo pra ler/escrever dado, e
   não importa nada de outro módulo (nem repository nem service).
3. Se a operação precisar de dado ou comportamento de outro módulo, isso não é chamada de service
   pra service — é o usecase orquestrando os dois services.
4. O service recebe o repository do próprio módulo **injetado no construtor** (ex:
   `constructor(private repository: IdentityRepository) {}`) — ele nunca faz `new
   XRepository()` dentro de si mesmo. A instância única do service (e do repository) é montada em
   `apps/api/src/app.ts` e decorada na instância raiz do Fastify — ver skill `dependency-injection`.

## Se algo não estiver coberto aqui

Isso indica uma decisão nova (ex: um módulo que parece precisar de mais de um service de verdade,
ou uma regra de negócio que depende de estado compartilhado entre módulos). Não resolva sozinho —
acione a skill `pattern-advisor` para decidir isso com o usuário, e depois atualize esta skill com
o resultado.
