import { Module } from '@nestjs/common';
import { StudentsService } from './students.service';
import { ServiceQueueService } from './service-queue.service';
import { ServiceStatsService } from './service-stats.service';
import { StudentsController } from './students.controller';
import { PrismaService } from 'src/database/prisma.service';

@Module({
  controllers: [StudentsController],
  providers: [
    StudentsService,
    ServiceQueueService,
    ServiceStatsService,
    PrismaService,
  ],
  exports: [StudentsService],
})
export class StudentsModule {}
