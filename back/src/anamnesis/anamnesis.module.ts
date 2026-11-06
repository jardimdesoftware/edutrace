import { Module } from '@nestjs/common';
import { AnamnesisService } from './anamnesis.service';
import { AnamnesisController } from './anamnesis.controller';
import { PrismaService } from 'src/database/prisma.service';
import { StudentsModule } from 'src/students/students.module';
import { FormRevisionsModule } from 'src/form-revisions/form-revisions.module';

@Module({
  imports: [StudentsModule, FormRevisionsModule],
  controllers: [AnamnesisController],
  providers: [AnamnesisService, PrismaService],
})
export class AnamnesisModule {}
