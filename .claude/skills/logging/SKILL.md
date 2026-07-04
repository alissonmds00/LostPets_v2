---
name: logging
description: >
  Documenta a convenção já decidida neste projeto para logging (debug e auditoria de requisição).
  Use esta skill sempre que o usuário pedir para adicionar logs, melhorar observabilidade, ou
  debugar/auditar o que aconteceu numa requisição — ex: "adiciona log em X", "como eu vejo o que
  essa rota recebeu", "preciso auditar essa requisição". Aplique a convenção documentada abaixo
  antes de escrever qualquer código; se a situação não estiver coberta por ela, não decida sozinho
  — acione a skill pattern-advisor para resolver a lacuna com o usuário.
---

# Logging

## Decisão (registrada em 2026-07-04)

- Logging aqui é **access log de requisição** — método, rota, status, duração, `request-id` — não
  um log de ação de negócio (isso seria um registro de auditoria persistido, avaliado e adiado por
  enquanto: só faz sentido quando os módulos que fazem ações sensíveis, ex. `moderation`, existirem).
- É **cross-cutting**, não pertence a nenhum módulo: vive em `app.ts`, via o logger nativo do
  Fastify (pino) — não em cada rota/service.
- Fastify já loga "incoming request" e "request completed" (com `responseTime`) automaticamente
  quando `logger` está habilitado, sem precisar de hook manual — a decisão aqui é só **fixar os
  serializers** (`req`: `method`+`url`; `res`: `statusCode`) explicitamente em `app.ts`
  (`requestLogSerializers`), em vez de confiar no default do Fastify sem documentar. Isso evita que
  alguém adicione `headers` de volta no futuro e vaze o cookie de sessão (`SESSION_COOKIE_NAME`) no
  log.
- Nunca logar corpo de requisição/resposta, header `cookie`/`authorization`, senha ou token —
  nenhum desses tem redação/allowlist definida ainda, então ficam fora até essa decisão ser tomada.
- Correlação por `request-id`: já existe via `genReqId` em `app.ts` (lê `x-request-id` do header,
  gera um `randomUUID()` se ausente) — todo log de uma mesma requisição carrega o mesmo id.
- Nível `info` em dev/prod, `silent` em test (evita ruído nos testes) — já existente, não mudou.

**Alternativas consideradas:** logar corpo de requisição/resposta pra debug mais detalhado —
rejeitado por enquanto (exigiria uma lista de redação de campos sensíveis antes de ser seguro, e
não foi pedido); registro de auditoria de negócio persistido no banco (tabela `AuditLog`) — adiado,
só faz sentido quando existir uma ação de negócio real pra auditar (Fase 2+, `pets`/`moderation`).

**Verificado com base em:** a própria documentação do Fastify sobre logging (logger habilitado via
`fastify(options)`, hooks automáticos de request/response, `serializers` para customizar o que cada
um loga) e o uso padrão do pino para logging estruturado em Node.

## Como aplicar

Isso já está aplicado em `app.ts` (`requestLogSerializers`, usado nas branches de logger de
dev/prod) — não precisa ser refeito por feature. Ao adicionar uma rota nova, nada extra é
necessário: o access log já cobre automaticamente qualquer rota registrada.

Quando `identity`/auth existir (Fase 1): estender o log de requisição pra incluir o id do usuário
autenticado, quando houver — isso é uma extensão natural, não uma decisão nova.

## Se algo não estiver coberto aqui

Isso indica uma decisão nova (ex: precisar logar corpo de requisição pra debug, ou introduzir um
registro de auditoria de negócio persistido). Não resolva sozinho — acione a skill
`pattern-advisor` para decidir isso com o usuário, e depois atualize esta skill com o resultado.
