import { ZodError } from 'zod';
import { AppError } from './app-error.js';

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
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.flatten() },
      },
    };
  }

  return {
    statusCode: 500,
    body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } },
  };
}
