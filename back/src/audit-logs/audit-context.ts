import { AsyncLocalStorage } from 'node:async_hooks';
import { AuditAction, Prisma } from '@prisma/client';

export type AuditActor = { id: number; name: string; email: string };

// Uma alteração registrada pela extensão do Prisma, antes de receber os dados
// da requisição que a causou.
export type AuditEntry = {
  action: AuditAction;
  entity: string;
  entity_id: number | null;
  changes: Prisma.InputJsonValue | null;
  detail: Prisma.InputJsonValue | null;
};

// Quem fez e de onde, para todas as alterações de uma requisição. As entradas
// esperam o fim da requisição para serem gravadas junto com o resultado dela.
export type AuditRequestContext = {
  actor: AuditActor | null;
  ip: string | null;
  method: string | null;
  route: string | null;
  entries: AuditEntry[];
};

export const auditContext = new AsyncLocalStorage<AuditRequestContext>();

export function toAuditLogRow(
  entry: AuditEntry,
  context: Omit<AuditRequestContext, 'entries'> | null,
  succeeded = true,
): Prisma.AuditLogCreateManyInput {
  return {
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entity_id,
    changes: entry.changes ?? Prisma.DbNull,
    detail: entry.detail ?? Prisma.DbNull,
    succeeded,
    actor_id: context?.actor?.id ?? null,
    actor_name: context?.actor?.name ?? null,
    actor_email: context?.actor?.email ?? null,
    method: context?.method ?? null,
    route: context?.route ?? null,
    ip: context?.ip ?? null,
  };
}
