import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Request,
} from '@nestjs/common';
import { ScreeningsService } from './screenings.service';
import { CreateScreeningDto } from './dto/create-screening.dto';
import { UpdateScreeningDto } from './dto/update-screening.dto';
import { AllowLevels } from 'src/auth/decorators/allow-levels.decorator';
import { LEVELS } from 'src/constants';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { authorOf } from 'src/form-revisions/revision-author';

@Controller('screenings')
export class ScreeningsController {
  constructor(private readonly screeningsService: ScreeningsService) {}

  @AllowLevels(LEVELS.PROFISSIONAL_SAUDE, LEVELS.PROFISSIONAL_NAPNE)
  @Post()
  create(
    @Body() createScreeningDto: CreateScreeningDto,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.screeningsService.create(createScreeningDto, authorOf(request));
  }

  @AllowLevels(
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
    LEVELS.PROFISSIONAL_NAPNE,
    LEVELS.PROFESSOR_AEE,
  )
  @Get()
  findAll() {
    return this.screeningsService.findAll();
  }

  @AllowLevels(
    LEVELS.ALUNO_ESTUDANTE,
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
    LEVELS.PROFISSIONAL_NAPNE,
    LEVELS.PROFESSOR_AEE,
  )
  @Get(':email')
  findOne(
    @Param('email') email: string,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.screeningsService.findOne(email, request);
  }

  @AllowLevels(LEVELS.PROFISSIONAL_SAUDE, LEVELS.PROFISSIONAL_NAPNE)
  @Patch(':email')
  update(
    @Param('email') email: string,
    @Body() updateScreeningDto: UpdateScreeningDto,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.screeningsService.update(
      email,
      updateScreeningDto,
      authorOf(request),
    );
  }

  @AllowLevels(LEVELS.PROFISSIONAL_SAUDE, LEVELS.PROFISSIONAL_NAPNE)
  @Delete(':email')
  remove(@Param('email') email: string) {
    return this.screeningsService.remove(email);
  }
}
