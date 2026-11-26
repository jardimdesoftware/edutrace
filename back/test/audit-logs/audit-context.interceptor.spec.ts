import { ExecutionContext } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { lastValueFrom, of, throwError } from 'rxjs';
import { auditContext } from 'src/audit-logs/audit-context';
import { AuditContextInterceptor } from 'src/audit-logs/audit-context.interceptor';

const entry = {
  action: AuditAction.UPDATE,
  entity: 'User',
  entity_id: 3,
  changes: { full_name: { from: 'A', to: 'B' } },
  detail: null,
};

function build() {
  const prisma = {
    auditLog: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const interceptor = new AuditContextInterceptor(prisma as any);
  const request = {
    user: { sub: 7, name: 'Admin', email: 'admin@x.com' },
    ip: '10.0.0.1',
    method: 'PATCH',
    route: { path: '/users/:id' },
    originalUrl: '/users/3?email=a@x.com',
  };
  const context = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { prisma, interceptor, context };
}

describe('AuditContextInterceptor', () => {
  it('saves the changes of the request with who made them', async () => {
    const { prisma, interceptor, context } = build();
    const handler = {
      handle: () => {
        auditContext.getStore()?.entries.push(entry);
        return of('ok');
      },
    };

    await lastValueFrom(interceptor.intercept(context, handler));

    expect(prisma.auditLog.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          entity: 'User',
          entity_id: 3,
          succeeded: true,
          actor_id: 7,
          actor_name: 'Admin',
          actor_email: 'admin@x.com',
          method: 'PATCH',
          route: '/users/:id',
          ip: '10.0.0.1',
        }),
      ],
    });
  });

  it('marks the changes of a failed request', async () => {
    const { prisma, interceptor, context } = build();
    const handler = {
      handle: () => {
        auditContext.getStore()?.entries.push(entry);
        return throwError(() => new Error('falhou'));
      },
    };

    await expect(
      lastValueFrom(interceptor.intercept(context, handler)),
    ).rejects.toThrow('falhou');

    expect(prisma.auditLog.createMany.mock.calls[0][0].data[0].succeeded).toBe(
      false,
    );
  });

  it('writes nothing when the request changed nothing', async () => {
    const { prisma, interceptor, context } = build();

    await lastValueFrom(
      interceptor.intercept(context, { handle: () => of(1) }),
    );

    expect(prisma.auditLog.createMany).not.toHaveBeenCalled();
  });
});
