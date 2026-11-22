import { Module } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { AeeAppointmentsController } from './aee-appointments.controller';
import { AeeAppointmentsService } from './aee-appointments.service';

@Module({
  controllers: [AeeAppointmentsController],
  providers: [AeeAppointmentsService, PrismaService],
})
export class AeeAppointmentsModule {}
