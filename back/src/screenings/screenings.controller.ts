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

@Controller('screenings')
export class ScreeningsController {
  constructor(private readonly screeningsService: ScreeningsService) {}

  @AllowLevels(LEVELS.ADMIN, LEVELS.PROFISSIONAL_SAUDE)
  @Post()
  create(@Body() createScreeningDto: CreateScreeningDto) {
    return this.screeningsService.create(createScreeningDto);
  }

  @AllowLevels(
    LEVELS.ADMIN,
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
  )
  @Get()
  findAll() {
    return this.screeningsService.findAll();
  }

  @AllowLevels(
    LEVELS.ADMIN,
    LEVELS.ALUNO_ESTUDANTE,
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
  )
  @Get(':email')
  findOne(
    @Param('email') email: string,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.screeningsService.findOne(email, request);
  }

  @AllowLevels(LEVELS.ADMIN, LEVELS.PROFISSIONAL_SAUDE)
  @Patch(':email')
  update(
    @Param('email') email: string,
    @Body() updateScreeningDto: UpdateScreeningDto,
  ) {
    return this.screeningsService.update(email, updateScreeningDto);
  }

  @AllowLevels(LEVELS.ADMIN, LEVELS.PROFISSIONAL_SAUDE)
  @Delete(':email')
  remove(@Param('email') email: string) {
    return this.screeningsService.remove(email);
  }
}
