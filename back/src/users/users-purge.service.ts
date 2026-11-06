import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsersService } from './users.service';

// Apaga de vez os usuários marcados para exclusão que passaram do prazo. A
// limpeza é idempotente: duas réplicas rodando juntas apagam cada usuário uma
// vez, porque a segunda não encontra mais a linha.
@Injectable()
export class UsersPurgeService {
  private readonly logger = new Logger(UsersPurgeService.name);

  constructor(private usersService: UsersService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredUsers(): Promise<{ deleted: number; deactivated: number }> {
    try {
      const result = await this.usersService.purgeExpired();

      if (result.deleted > 0 || result.deactivated > 0) {
        this.logger.log(
          'Carência encerrada: ' +
            result.deleted +
            ' apagados, ' +
            result.deactivated +
            ' desativados',
        );
      }

      return result;
    } catch (error) {
      this.logger.error(
        'Falha na limpeza dos usuários marcados para exclusão',
        error instanceof Error ? error.stack : String(error),
      );
      return { deleted: 0, deactivated: 0 };
    }
  }
}
