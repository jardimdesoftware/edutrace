import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      adapter: new PrismaPg(
        process.env.DATABASE_URL || '******localhost:5432/testdb',
      ),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
