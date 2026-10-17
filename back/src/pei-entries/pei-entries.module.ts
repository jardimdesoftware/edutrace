import { Module } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { StudentsModule } from 'src/students/students.module';
import { PeiEntriesController } from './pei-entries.controller';
import { PeiEntriesService } from './pei-entries.service';

@Module({
  imports: [StudentsModule],
  controllers: [PeiEntriesController],
  providers: [PeiEntriesService, PrismaService],
})
export class PeiEntriesModule {}
