import { Controller, Get, Param } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { AllowLevels } from 'src/auth/decorators/allow-levels.decorator';
import { LEVELS } from 'src/constants';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @AllowLevels(
    LEVELS.ADMIN,
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
  )
  @Get(':email')
  findOne(@Param('email') email: string) {
    return this.reportsService.findOne(email);
  }
}
