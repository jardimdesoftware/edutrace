import {
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Query,
  Request,
} from '@nestjs/common';
import { FormType } from '@prisma/client';
import { AllowLevels } from 'src/auth/decorators/allow-levels.decorator';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { LEVELS } from 'src/constants';
import { FormRevisionsService } from './form-revisions.service';

// O estudante não entra: ele lê o próprio formulário, mas não vê quem o
// editou. O service confere o nível pelo tipo do formulário.
const HISTORY_LEVELS = [
  LEVELS.PROFISSIONAL_EDUCACAO,
  LEVELS.PROFISSIONAL_SAUDE,
  LEVELS.PROFISSIONAL_NAPNE,
  LEVELS.PROFESSOR_AEE,
] as const;

@Controller('form-revisions')
export class FormRevisionsController {
  constructor(private readonly formRevisionsService: FormRevisionsService) {}

  // record é o período letivo do PAEE; os demais formulários não o usam.
  @AllowLevels(...HISTORY_LEVELS)
  @Get(':formType/:email')
  list(
    @Param('formType', new ParseEnumPipe(FormType)) formType: FormType,
    @Param('email') email: string,
    @Query('record') record: string | undefined,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.formRevisionsService.list(
      formType,
      email,
      record ?? '',
      request.user.roles,
    );
  }

  @AllowLevels(...HISTORY_LEVELS)
  @Get(':formType/:email/:version')
  findVersion(
    @Param('formType', new ParseEnumPipe(FormType)) formType: FormType,
    @Param('email') email: string,
    @Param('version', ParseIntPipe) version: number,
    @Query('record') record: string | undefined,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.formRevisionsService.findVersion(
      formType,
      email,
      record ?? '',
      version,
      request.user.roles,
    );
  }
}
