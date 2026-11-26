import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { PrismaService } from 'src/database/prisma.service';
import { AuthenticatedRequest } from 'src/comments/types/express';
import {
  auditContext,
  AuditRequestContext,
  toAuditLogRow,
} from './audit-context';

// Abre o contexto de auditoria de cada requisição com quem a fez, e no fim grava
// as alterações que ela causou, marcando se a requisição falhou (a transação
// dela pode ter sido desfeita). O AuthGuard roda antes e já preencheu o usuário.
@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditContextInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & Partial<Pick<AuthenticatedRequest, 'user'>>>();
    const user = request.user;
    // O padrão da rota (/users/:id), e não a URL: a URL traz e-mail e termos de
    // busca, que não entram no log.
    const route = (request.route as { path?: string } | undefined)?.path;
    const store: AuditRequestContext = {
      actor: user ? { id: user.sub, name: user.name, email: user.email } : null,
      ip: request.ip ?? null,
      method: request.method,
      route: route ?? null,
      entries: [],
    };

    return new Observable((subscriber) =>
      auditContext.run(store, () =>
        next
          .handle()
          .pipe(
            tap({
              complete: () => this.flush(store, true),
              error: () => this.flush(store, false),
            }),
          )
          .subscribe(subscriber),
      ),
    );
  }

  private flush(store: AuditRequestContext, succeeded: boolean): void {
    if (store.entries.length === 0) {
      return;
    }
    const data = store.entries.map((entry) =>
      toAuditLogRow(entry, store, succeeded),
    );
    this.prisma.auditLog
      .createMany({ data })
      .catch((error: unknown) =>
        this.logger.error(
          'Falha ao gravar o log de auditoria',
          error instanceof Error ? error.stack : String(error),
        ),
      );
  }
}
