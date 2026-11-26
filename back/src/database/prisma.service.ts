import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { withAuditTrail } from 'src/audit-logs/audit-trail.extension';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    super({
      adapter: new PrismaPg(connectionString),
    });

    // Quem injeta o PrismaService recebe o client com a trilha de auditoria:
    // nenhuma escrita passa sem registro.
    return withAuditTrail(this);
  }

  async onModuleInit() {
    await this.$connect();
  }
}
