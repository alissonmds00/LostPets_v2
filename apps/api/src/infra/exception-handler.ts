import { ZodError } from 'zod';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { AppError } from './errors/app-error.js';

export interface ErrorResponse {
  statusCode: number;
  body: { error: { code: string; message: string; details?: unknown } };
}

// Every error response, regardless of source, ends up in this one shape:
// { error: { code, message, details? } }. Routes should throw AppError
// subclasses (or let Zod validation fail) rather than building responses by hand.
//
// Kept as a plain function (no Fastify types) so callers can pass it straight
// into `app.setErrorHandler((error, request, reply) => {...})` and let
// TypeScript infer the correct request/reply generics from Fastify itself,
// rather than fighting Fastify's generics under `exactOptionalPropertyTypes`.
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

  // fastify-type-provider-zod's validatorCompiler doesn't throw a raw ZodError
  // for a request body/params/querystring that fails schema validation — it
  // wraps each Zod issue into Fastify's own `error.validation` array (see
  // hasZodFastifySchemaValidationErrors), which is what actually reaches this
  // handler on an invalid request body. Same 400 shape as the ZodError branch
  // above, just recognizing the wrapped form.
  if (hasZodFastifySchemaValidationErrors(error)) {
    return {
      statusCode: 400,
      body: {
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.validation },
      },
    };
  }

  return {
    statusCode: 500,
    body: { error: { code: 'INTERNAL_ERROR', message: 'Algo deu errado' } },
  };
}
