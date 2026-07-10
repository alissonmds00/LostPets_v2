import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';

// Fica em infra/, não em modules/identity/: hashing de senha é encanamento
// técnico (wrapper do argon2) sem significado de negócio próprio, igual ao
// cliente Prisma ou o carregamento de env que já ficam aqui — não vira
// "de identity" só porque identity é o único chamador hoje. Ver skill
// infra-placement pro critério geral.
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}

// Mitigação de timing attack pra /login (ver SECURITY-AUDIT.md, seção 4, item
// 1): quando o usuário não é encontrado, IdentityService.login ainda precisa
// pagar o mesmo custo de CPU do argon2 que o caminho de "senha errada", pra
// que as duas respostas de falha levem o mesmo tempo e não vazem se um e-mail
// está cadastrado. Computado sob demanda e cacheado em memória pra que o hash
// (e seu custo de CPU) seja gerado uma vez por processo, não uma vez por
// requisição.
let dummyPasswordHashPromise: Promise<string> | undefined;

export function getDummyPasswordHash(): Promise<string> {
  if (!dummyPasswordHashPromise) {
    dummyPasswordHashPromise = argon2.hash(randomUUID());
  }
  return dummyPasswordHashPromise;
}
