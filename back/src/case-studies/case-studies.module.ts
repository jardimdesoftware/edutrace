import { Module } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { StudentsModule } from 'src/students/students.module';
import { CaseStudiesController } from './case-studies.controller';
import { CaseStudiesService } from './case-studies.service';

@Module({
  imports: [StudentsModule],
  controllers: [CaseStudiesController],
  providers: [CaseStudiesService, PrismaService],
})
export class CaseStudiesModule {}
