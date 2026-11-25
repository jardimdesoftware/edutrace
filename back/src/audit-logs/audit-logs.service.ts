import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { AUDIT_LOG_EXPORT_LIMIT, AUDIT_LOG_PAGE_SIZE } from 'src/constants';
import { auditContext, AuditEntry } from './audit-context';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import { RegisterDownloadDto } from './dto/register-download.dto';

// Entra no contexto da requisição, para sair gravado com quem a fez.
function recordInRequest(entry: AuditEntry): void {
  auditContext.getStore()?.entries.push(entry);
}

export function auditLogsWhere(
  query: ListAuditLogsQueryDto,
): Prisma.AuditLogWhereInput {
  const contains = (value: string) => ({
    contains: value,
    mode: Prisma.QueryMode.insensitive,
  });

  return {
    ...(query.action ? { action: query.action } : {}),
    ...(query.entity ? { entity: query.entity } : {}),
    ...(query.actor_id ? { actor_id: query.actor_id } : {}),
    ...(query.from || query.to
      ? {
          created_at: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { actor_name: contains(query.search) },
            { actor_email: contains(query.search) },
            { entity: contains(query.search) },
            { route: contains(query.search) },
          ],
        }
      : {}),
  };
}

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAuditLogsQueryDto) {
    const page = query.page ?? 1;
    const where = auditLogsWhere(query);
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * AUDIT_LOG_PAGE_SIZE,
        take: AUDIT_LOG_PAGE_SIZE,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    // Toda consulta ao log também fica registrada (OWASP Logging Cheat Sheet,
    // "Protection": o acesso aos logs é registrado e monitorado).
    recordInRequest({
      action: AuditAction.VIEW_LOG,
      entity: 'AuditLog',
      entity_id: null,
      changes: null,
      detail: { ...query },
    });

    return { items, total, page, pageSize: AUDIT_LOG_PAGE_SIZE };
  }

  // Todos os registros do filtro, até AUDIT_LOG_EXPORT_LIMIT; truncated avisa
  // que o filtro tinha mais. A exportação fica registrada como download do log.
  async export(query: ListAuditLogsQueryDto) {
    const filters = { ...query, page: undefined };
    const rows = await this.prisma.auditLog.findMany({
      where: auditLogsWhere(filters),
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: AUDIT_LOG_EXPORT_LIMIT + 1,
    });
    const items = rows.slice(0, AUDIT_LOG_EXPORT_LIMIT);

    recordInRequest({
      action: AuditAction.DOWNLOAD,
      entity: 'AuditLog',
      entity_id: null,
      changes: null,
      detail: { ...filters, count: items.length },
    });

    return { items, truncated: rows.length > AUDIT_LOG_EXPORT_LIMIT };
  }

  registerDownload(dto: RegisterDownloadDto): void {
    recordInRequest({
      action: AuditAction.DOWNLOAD,
      entity: dto.entity,
      entity_id: dto.entity_id ?? null,
      changes: null,
      detail: null,
    });
  }
}
