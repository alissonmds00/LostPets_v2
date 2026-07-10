import type { z } from 'zod';
import type {
  createReportBodySchema,
  createReportInputSchema,
  listReportsResponseSchema,
  reportSchema,
  resolveReportInputSchema,
  resolveReportOutcomeSchema,
  resolveReportParamsSchema,
  resolveReportBodySchema,
} from './moderation.schema.js';

export type CreateReportBodyDto = z.infer<typeof createReportBodySchema>;
export type CreateReportInputDto = z.infer<typeof createReportInputSchema>;
export type ReportDto = z.infer<typeof reportSchema>;
export type ListReportsResponseDto = z.infer<typeof listReportsResponseSchema>;
export type ResolveReportParamsDto = z.infer<typeof resolveReportParamsSchema>;
export type ResolveReportOutcomeDto = z.infer<typeof resolveReportOutcomeSchema>;
export type ResolveReportBodyDto = z.infer<typeof resolveReportBodySchema>;
export type ResolveReportInputDto = z.infer<typeof resolveReportInputSchema>;
