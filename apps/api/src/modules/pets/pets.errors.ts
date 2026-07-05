import { AppError } from '../../infra/errors/app-error.js';

// Regra de negócio específica de `pets` (validação de foto enviada no
// cadastro de anúncio) — não é um erro genérico reaproveitável por qualquer
// módulo, então mora aqui em vez de infra/errors/app-error.ts (ver skill
// exception-handler).
export class InvalidPetPhotoError extends AppError {
  constructor(message: string) {
    super(422, 'INVALID_PET_PHOTO', message);
  }
}
