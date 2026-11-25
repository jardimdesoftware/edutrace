import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { AllowLevels } from 'src/auth/decorators/allow-levels.decorator';
import { LEVELS } from 'src/constants';
import { AuditLogsService } from './audit-logs.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import { RegisterDownloadDto } from './dto/register-download.dto';

@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @AllowLevels(LEVELS.ADMIN)
  @Get()
  list(@Query() query: ListAuditLogsQueryDto) {
    return this.auditLogsService.list(query);
  }

  @AllowLevels(LEVELS.ADMIN)
  @Get('export')
  export(@Query() query: ListAuditLogsQueryDto) {
    return this.auditLogsService.export(query);
  }

  // Quem gera o relatório do estudante ou a agenda em PDF.
  @AllowLevels(
    LEVELS.ADMIN,
    LEVELS.ALUNO_ESTUDANTE,
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
    LEVELS.PROFISSIONAL_NAPNE,
    LEVELS.PROFESSOR_AEE,
  )
  @HttpCode(204)
  @Post('downloads')
  registerDownload(@Body() dto: RegisterDownloadDto): void {
    this.auditLogsService.registerDownload(dto);
  }
}
