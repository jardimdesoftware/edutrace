import { Module } from '@nestjs/common';
import { ScreeningsService } from './screenings.service';
import { ScreeningsController } from './screenings.controller';
import { PrismaService } from 'src/database/prisma.service';
import { StudentsModule } from 'src/students/students.module';
import { FormRevisionsModule } from 'src/form-revisions/form-revisions.module';

@Module({
  imports: [StudentsModule, FormRevisionsModule],
  controllers: [ScreeningsController],
  providers: [ScreeningsService, PrismaService],
  exports: [ScreeningsService],
})
export class ScreeningsModule {}
