import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { AllowLevels } from 'src/auth/decorators/allow-levels.decorator';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { LEVELS } from 'src/constants';
import { AeeAppointmentsService } from './aee-appointments.service';
import {
  CreateAppointmentDto,
  ListAppointmentsQueryDto,
  UpdateAppointmentDto,
} from './dto/appointment.dto';

// A agenda é só do Professor do AEE: nem o administrador a acessa. O professor
// da sessão é o dono, e nenhuma rota recebe o id do professor.
@Controller('aee-appointments')
export class AeeAppointmentsController {
  constructor(private readonly service: AeeAppointmentsService) {}

  @AllowLevels(LEVELS.PROFESSOR_AEE)
  @Get()
  list(
    @Query() query: ListAppointmentsQueryDto,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.service.list(request.user.sub, query.from, query.to);
  }

  // Os estudantes que o professor atende, para o seletor da agenda.
  @AllowLevels(LEVELS.PROFESSOR_AEE)
  @Get('students')
  students(@Request() request: AuthenticatedRequest) {
    return this.service.students(request.user.sub);
  }

  @AllowLevels(LEVELS.PROFESSOR_AEE)
  @Post()
  create(
    @Body() dto: CreateAppointmentDto,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.service.create(request.user.sub, dto);
  }

  @AllowLevels(LEVELS.PROFESSOR_AEE)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAppointmentDto,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.service.update(request.user.sub, id, dto);
  }

  @AllowLevels(LEVELS.PROFESSOR_AEE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() request: AuthenticatedRequest,
  ) {
    await this.service.remove(request.user.sub, id);
  }
}
