import { Module } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { StudentsModule } from 'src/students/students.module';
import { FormRevisionsController } from './form-revisions.controller';
import { FormRevisionsService } from './form-revisions.service';

@Module({
  imports: [StudentsModule],
  controllers: [FormRevisionsController],
  providers: [FormRevisionsService, PrismaService],
  exports: [FormRevisionsService],
})
export class FormRevisionsModule {}
