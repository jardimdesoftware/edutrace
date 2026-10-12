import { Module } from '@nestjs/common';
import { AnamnesisService } from './anamnesis.service';
import { AnamnesisController } from './anamnesis.controller';
import { PrismaService } from 'src/database/prisma.service';
import { StudentsModule } from 'src/students/students.module';

@Module({
  imports: [StudentsModule],
  controllers: [AnamnesisController],
  providers: [AnamnesisService, PrismaService],
})
export class AnamnesisModule {}
