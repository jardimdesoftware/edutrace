import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { ServiceQueueService } from './service-queue.service';
import { AllowLevels } from 'src/auth/decorators/allow-levels.decorator';
import { LEVELS } from 'src/constants';
import { maskUserCpf, maskUsersCpf } from 'src/common/mask-cpf';
import { AuthenticatedRequest } from 'src/comments/types/express';

@Controller('students')
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly serviceQueueService: ServiceQueueService,
  ) {}

  @AllowLevels(
    LEVELS.ADMIN,
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
    LEVELS.PROFISSIONAL_NAPNE,
  )
  @Get()
  async findAll() {
    return maskUsersCpf(await this.studentsService.findAll());
  }

  @AllowLevels(
    LEVELS.ADMIN,
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
    LEVELS.PROFISSIONAL_NAPNE,
  )
  @Get(':email')
  async findOne(@Param('email') email: string) {
    const student = await this.studentsService.findOne(email);
    return student ? maskUserCpf(student) : student;
  }

  // As três transições devolvem o estudante já atualizado. Respondem 200: a
  // ação altera um estudante que já existe, e não cria um registro.
  @AllowLevels(LEVELS.PROFISSIONAL_NAPNE)
  @HttpCode(HttpStatus.OK)
  @Post(':email/service/assume')
  async assume(
    @Param('email') email: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return maskUserCpf(
      await this.serviceQueueService.assume(email, req.user.sub),
    );
  }

  @AllowLevels(LEVELS.ADMIN, LEVELS.PROFISSIONAL_NAPNE)
  @HttpCode(HttpStatus.OK)
  @Post(':email/service/close')
  async close(@Param('email') email: string, @Req() req: AuthenticatedRequest) {
    return maskUserCpf(await this.serviceQueueService.close(email, req.user));
  }

  @AllowLevels(LEVELS.ADMIN, LEVELS.PROFISSIONAL_NAPNE)
  @HttpCode(HttpStatus.OK)
  @Post(':email/service/reopen')
  async reopen(@Param('email') email: string) {
    return maskUserCpf(await this.serviceQueueService.reopen(email));
  }
}
