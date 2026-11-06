import { Controller, Get, Param, Request } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { AllowLevels } from 'src/auth/decorators/allow-levels.decorator';
import { LEVELS } from 'src/constants';
import { AuthenticatedRequest } from 'src/comments/types/express';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // Declarada antes de ':email', que casaria "generator" como um e-mail.
  @AllowLevels(
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
    LEVELS.PROFISSIONAL_NAPNE,
    LEVELS.PROFESSOR_AEE,
  )
  @Get('generator')
  generator(@Request() request: AuthenticatedRequest) {
    return this.reportsService.generator(request.user.sub);
  }

  @AllowLevels(
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
    LEVELS.PROFISSIONAL_NAPNE,
    LEVELS.PROFESSOR_AEE,
  )
  @Get(':email')
  findOne(@Param('email') email: string) {
    return this.reportsService.findOne(email);
  }
}
