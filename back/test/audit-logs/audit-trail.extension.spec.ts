import { AuditAction } from '@prisma/client';
import { AuditEntry } from 'src/audit-logs/audit-context';
import { PROTECTED_VALUE } from 'src/audit-logs/audit-changes';
import {
  AuditDependencies,
  auditOperation,
} from 'src/audit-logs/audit-trail.extension';

const FIELDS = ['id', 'full_name', 'password', 'updated_at'];

function build(before: Record<string, unknown> | null = null) {
  const entries: AuditEntry[] = [];
  const delegate = {
    findUnique: jest.fn().mockResolvedValue(before),
    findMany: jest.fn().mockResolvedValue([{ id: 4 }, { id: 5 }]),
  };
  const deps: AuditDependencies = {
    delegateOf: () => delegate,
    scalarFieldsOf: () => FIELDS,
    record: (entry) => entries.push(entry),
  };
  return { entries, delegate, deps };
}

describe('auditOperation', () => {
  it('records an update with what changed, read before the write', async () => {
    const { entries, delegate, deps } = build({
      id: 1,
      full_name: 'Ana',
      password: 'h',
    });
    const query = jest
      .fn()
      .mockResolvedValue({ id: 1, full_name: 'Bia', password: 'h' });

    await auditOperation(
      {
        model: 'User',
        operation: 'update',
        args: { where: { id: 1 }, data: { full_name: 'Bia' } },
        query,
      },
      deps,
    );

    expect(delegate.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(entries).toEqual([
      {
        action: AuditAction.UPDATE,
        entity: 'User',
        entity_id: 1,
        changes: { full_name: { from: 'Ana', to: 'Bia' } },
        detail: null,
      },
    ]);
  });

  it('reads every field but returns only what the caller selected', async () => {
    const { entries, deps } = build({ id: 1, full_name: 'Ana', password: 'h' });
    const query = jest
      .fn()
      .mockResolvedValue({ id: 1, full_name: 'Ana', password: 'novo' });

    const result = await auditOperation(
      {
        model: 'User',
        operation: 'update',
        args: { where: { id: 1 }, data: {}, select: { id: true } },
        query,
      },
      deps,
    );

    expect(query.mock.calls[0][0].select).toEqual({
      id: true,
      full_name: true,
      password: true,
      updated_at: true,
    });
    expect(result).toEqual({ id: 1 });
    expect(entries[0].changes).toEqual({
      password: { from: PROTECTED_VALUE, to: PROTECTED_VALUE },
    });
  });

  it('drops omitted fields from the result after reading them', async () => {
    const { entries, deps } = build({ id: 1, full_name: 'Ana', password: 'h' });
    const query = jest
      .fn()
      .mockResolvedValue({ id: 1, full_name: 'Ana', password: 'h' });

    const result = await auditOperation(
      {
        model: 'User',
        operation: 'update',
        args: { where: { id: 1 }, data: {}, omit: { password: true } },
        query,
      },
      deps,
    );

    expect(query.mock.calls[0][0]).not.toHaveProperty('omit');
    expect(result).toEqual({ id: 1, full_name: 'Ana' });
    expect(entries).toEqual([]);
  });

  it('records a create and a delete', async () => {
    const created = build();
    await auditOperation(
      {
        model: 'Comments',
        operation: 'create',
        args: { data: {} },
        query: jest.fn().mockResolvedValue({ id: 9, full_name: 'x' }),
      },
      created.deps,
    );

    const deleted = build({ id: 9, full_name: 'x' });
    await auditOperation(
      {
        model: 'Comments',
        operation: 'delete',
        args: { where: { id: 9 } },
        query: jest.fn().mockResolvedValue({ id: 9 }),
      },
      deleted.deps,
    );

    expect(created.entries[0]).toMatchObject({
      action: AuditAction.CREATE,
      entity_id: 9,
      changes: { full_name: { from: null, to: PROTECTED_VALUE } },
    });
    expect(deleted.entries[0]).toMatchObject({
      action: AuditAction.DELETE,
      entity_id: 9,
    });
  });

  it('records a bulk update with the affected ids and the new values', async () => {
    const { entries, deps } = build();

    await auditOperation(
      {
        model: 'User',
        operation: 'updateMany',
        args: { where: {}, data: { password: 'x', full_name: 'Y' } },
        query: jest.fn().mockResolvedValue({ count: 2 }),
      },
      deps,
    );

    expect(entries[0]).toEqual({
      action: AuditAction.UPDATE,
      entity: 'User',
      entity_id: null,
      changes: null,
      detail: {
        count: 2,
        ids: [4, 5],
        data: { password: PROTECTED_VALUE, full_name: 'Y' },
      },
    });
  });

  it('skips reads, the session table and bulk writes that changed nothing', async () => {
    const { entries, delegate, deps } = build();
    const query = jest.fn().mockResolvedValue({ count: 0 });

    await auditOperation(
      { model: 'User', operation: 'findMany', args: {}, query },
      deps,
    );
    await auditOperation(
      { model: 'Session', operation: 'update', args: {}, query },
      deps,
    );
    await auditOperation(
      { model: 'User', operation: 'deleteMany', args: { where: {} }, query },
      deps,
    );

    expect(entries).toEqual([]);
    expect(delegate.findUnique).not.toHaveBeenCalled();
  });
});
