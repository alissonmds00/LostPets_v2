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

  // fastify-type-provider-zod's validatorCompiler (v4) never throws a raw
  // ZodError for a request body/params/querystring/headers failure — it
  // returns a Fastify FST_ERR_VALIDATION error carrying a `.validation` array
  // instead (the ZodError branch above only ever catches a ZodError thrown
  // directly by application code, not by Fastify's schema validation). This
  // is the library's own documented type guard for that case.
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
