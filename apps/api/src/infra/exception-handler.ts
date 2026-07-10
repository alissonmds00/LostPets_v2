import { ZodError } from 'zod';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { AppError } from './errors/app-error.js';

export interface ErrorResponse {
  statusCode: number;
  body: { error: { code: string; message: string; details?: unknown } };
}

// Toda resposta de erro, seja qual for a origem, cai neste formato único:
// { error: { code, message, details? } }. Rotas devem lançar subclasses de
// AppError (ou deixar a validação do Zod falhar) em vez de montar a resposta
// na mão.
//
// Mantida como função pura (sem tipos do Fastify) pra poder ser passada
// direto pra `app.setErrorHandler((error, request, reply) => {...})` e
// deixar o TypeScript inferir os generics de request/reply a partir do
// próprio Fastify, em vez de brigar com os generics dele sob
// `exactOptionalPropertyTypes`.
export function formatErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: { error: { code: error.code, message: error.message, details: error.details } },
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      body: {
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos', details: error.flatten() },
      },
    };
  }

  // O validatorCompiler (v4) do fastify-type-provider-zod nunca lança um
  // ZodError puro pra falha de body/params/querystring/headers — ele retorna
  // um erro FST_ERR_VALIDATION do Fastify com um array `.validation` (o branch
  // de ZodError acima só captura ZodError lançado direto por código da
  // aplicação, não pela validação de schema do Fastify). Este é o type guard
  // documentado pela própria lib pra esse caso.
  if (hasZodFastifySchemaValidationErrors(error)) {
    return {
      statusCode: 400,
      body: {
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos', details: error.validation },
      },
    };
  }

  return {
    statusCode: 500,
    body: { error: { code: 'INTERNAL_ERROR', message: 'Algo deu errado' } },
  };
}
