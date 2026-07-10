import { ConflictError } from '../../infra/errors/app-error.js';

// Regra de negócio específica de `moderation` (resolver uma denúncia que já
// não está PENDING) — não é um erro genérico reaproveitável por qualquer
// módulo, então mora aqui em vez de infra/errors/app-error.ts (ver skill
// exception-handler).
export class ReportAlreadyResolvedError extends ConflictError {
  constructor() {
    super('Esta denúncia já foi resolvida');
  }
}
