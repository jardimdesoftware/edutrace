import { AuditAction } from '@prisma/client';
import {
  auditContext,
  AuditRequestContext,
} from 'src/audit-logs/audit-context';
import {
  AuditLogsService,
  auditLogsWhere,
} from 'src/audit-logs/audit-logs.service';
import { AUDIT_LOG_EXPORT_LIMIT, AUDIT_LOG_PAGE_SIZE } from 'src/constants';

function inRequest<T>(run: () => T): { result: T; store: AuditRequestContext } {
  const store: AuditRequestContext = {
    actor: { id: 1, name: 'Admin', email: 'admin@x.com' },
    ip: null,
    method: 'GET',
    route: '/audit-logs',
    entries: [],
  };
  return { result: auditContext.run(store, run), store };
}

describe('AuditLogsService', () => {
  it('builds the filters and the search', () => {
    expect(
      auditLogsWhere({
        action: AuditAction.DELETE,
        entity: 'Comments',
        actor_id: 4,
        from: '2026-01-01T00:00:00Z',
        search: 'ana',
      }),
    ).toEqual({
      action: AuditAction.DELETE,
      entity: 'Comments',
      actor_id: 4,
      created_at: { gte: new Date('2026-01-01T00:00:00Z') },
      OR: [
        { actor_name: { contains: 'ana', mode: 'insensitive' } },
        { actor_email: { contains: 'ana', mode: 'insensitive' } },
        { entity: { contains: 'ana', mode: 'insensitive' } },
        { route: { contains: 'ana', mode: 'insensitive' } },
      ],
    });
  });

  it('lists a page, newest first, and logs the access to the log', async () => {
    const prisma = {
      auditLog: {
        findMany: jest.fn().mockResolvedValue([{ id: 1 }]),
        count: jest.fn().mockResolvedValue(51),
      },
    };
    const service = new AuditLogsService(prisma as any);

    const { result, store } = inRequest(() => service.list({ page: 2 }));

    expect(await result).toEqual({
      items: [{ id: 1 }],
      total: 51,
      page: 2,
      pageSize: AUDIT_LOG_PAGE_SIZE,
    });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip: AUDIT_LOG_PAGE_SIZE,
        take: AUDIT_LOG_PAGE_SIZE,
      }),
    );
    expect(store.entries).toEqual([
      expect.objectContaining({ action: AuditAction.VIEW_LOG }),
    ]);
  });

  it('exports every filtered row up to the limit and logs the export', async () => {
    const rows = Array.from({ length: AUDIT_LOG_EXPORT_LIMIT + 1 }, (_, i) => ({
      id: i,
    }));
    const prisma = {
      auditLog: { findMany: jest.fn().mockResolvedValue(rows) },
    };
    const service = new AuditLogsService(prisma as any);

    const { result, store } = inRequest(() =>
      service.export({ entity: 'User', page: 3 }),
    );
    const exported = await result;

    expect(exported.items).toHaveLength(AUDIT_LOG_EXPORT_LIMIT);
    expect(exported.truncated).toBe(true);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { entity: 'User' },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: AUDIT_LOG_EXPORT_LIMIT + 1,
    });
    expect(store.entries).toEqual([
      expect.objectContaining({
        action: AuditAction.DOWNLOAD,
        entity: 'AuditLog',
        detail: expect.objectContaining({
          entity: 'User',
          count: AUDIT_LOG_EXPORT_LIMIT,
        }),
      }),
    ]);
  });

  it('records a PDF download', () => {
    const service = new AuditLogsService({} as any);

    const { store } = inRequest(() =>
      service.registerDownload({ entity: 'StudentReport', entity_id: 3 }),
    );

    expect(store.entries).toEqual([
      {
        action: AuditAction.DOWNLOAD,
        entity: 'StudentReport',
        entity_id: 3,
        changes: null,
        detail: null,
      },
    ]);
  });
});
