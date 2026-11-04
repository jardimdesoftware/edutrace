import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { ServiceQueueService } from './service-queue.service';
import { ServiceStatsService } from './service-stats.service';
import { AllowLevels } from 'src/auth/decorators/allow-levels.decorator';
import { LEVELS } from 'src/constants';
import { maskUserCpf, maskUsersCpf } from 'src/common/mask-cpf';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { SetPedagogicalManagerDto } from './dto/set-pedagogical-manager.dto';
import { SetCourseDto } from './dto/set-course.dto';

@Controller('students')
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly serviceQueueService: ServiceQueueService,
    private readonly serviceStatsService: ServiceStatsService,
  ) {}

  @AllowLevels(
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
    LEVELS.PROFISSIONAL_NAPNE,
    LEVELS.PROFESSOR_AEE,
  )
  @Get()
  async findAll(@Req() req: AuthenticatedRequest) {
    return maskUsersCpf(await this.studentsService.findAll(req.user.roles));
  }

  // Declarada antes de GET :email: o parâmetro casa com qualquer texto, e a
  // rota que viesse depois dele seria tratada como o e-mail "service-stats".
  @AllowLevels(LEVELS.PROFISSIONAL_NAPNE)
  @Get('service-stats')
  serviceStats() {
    return this.serviceStatsService.getStats();
  }

  // Pelo mesmo motivo de service-stats, vem antes de GET :email.
  @AllowLevels(LEVELS.PROFISSIONAL_NAPNE)
  @Get('pedagogical-manager-options')
  pedagogicalManagerOptions() {
    return this.studentsService.findPedagogicalManagerOptions();
  }

  @AllowLevels(
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
    LEVELS.PROFISSIONAL_NAPNE,
    LEVELS.PROFESSOR_AEE,
  )
  @Get(':email')
  async findOne(
    @Param('email') email: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const student = await this.studentsService.findOne(email, req.user.roles);
    return student ? maskUserCpf(student) : student;
  }

  // Devolve o estudante já atualizado. Responde 200: a ação altera um estudante
  // que já existe, e não cria um registro.
  @AllowLevels(LEVELS.PROFISSIONAL_NAPNE)
  @HttpCode(HttpStatus.OK)
  @Patch(':email/pedagogical-manager')
  async setPedagogicalManager(
    @Param('email') email: string,
    @Body() dto: SetPedagogicalManagerDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return maskUserCpf(
      await this.studentsService.setPedagogicalManager(
        email,
        dto,
        req.user.roles,
      ),
    );
  }

  @AllowLevels(LEVELS.PROFISSIONAL_NAPNE)
  @HttpCode(HttpStatus.OK)
  @Patch(':email/course')
  async setCourse(
    @Param('email') email: string,
    @Body() dto: SetCourseDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return maskUserCpf(
      await this.studentsService.setCourse(email, dto.course, req.user.roles),
    );
  }

  // As três transições devolvem o estudante já atualizado. Respondem 200: a
  // ação altera um estudante que já existe, e não cria um registro.
  @AllowLevels(LEVELS.PROFESSOR_AEE)
  @HttpCode(HttpStatus.OK)
  @Post(':email/service/assume')
  async assume(
    @Param('email') email: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return maskUserCpf(
      await this.serviceQueueService.assume(
        email,
        req.user.sub,
        req.user.roles,
      ),
    );
  }

  @AllowLevels(LEVELS.PROFESSOR_AEE)
  @HttpCode(HttpStatus.OK)
  @Post(':email/service/close')
  async close(@Param('email') email: string, @Req() req: AuthenticatedRequest) {
    return maskUserCpf(await this.serviceQueueService.close(email, req.user));
  }

  @AllowLevels(LEVELS.PROFISSIONAL_NAPNE, LEVELS.PROFESSOR_AEE)
  @HttpCode(HttpStatus.OK)
  @Post(':email/service/reopen')
  async reopen(
    @Param('email') email: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return maskUserCpf(
      await this.serviceQueueService.reopen(email, req.user.roles),
    );
  }
}
