import { Module } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { StudentsModule } from 'src/students/students.module';
import { FormRevisionsModule } from 'src/form-revisions/form-revisions.module';
import { AeePlansController } from './aee-plans.controller';
import { AeePlansService } from './aee-plans.service';

@Module({
  imports: [StudentsModule, FormRevisionsModule],
  controllers: [AeePlansController],
  providers: [AeePlansService, PrismaService],
})
export class AeePlansModule {}
