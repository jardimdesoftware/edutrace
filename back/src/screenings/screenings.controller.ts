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
import { Levels } from 'src/auth/decorators/levels.decorator';
import { LEVELS } from 'src/constants';
import { AuthenticatedRequest } from 'src/comments/types/express';

@Controller('screenings')
export class ScreeningsController {
  constructor(private readonly screeningsService: ScreeningsService) {}

  @Levels(LEVELS.ALUNO_ESTUDANTE, LEVELS.PROFISSIONAL_EDUCACAO)
  @Post()
  create(@Body() createScreeningDto: CreateScreeningDto) {
    return this.screeningsService.create(createScreeningDto);
  }

  @Levels(LEVELS.ALUNO_ESTUDANTE)
  @Get()
  findAll() {
    return this.screeningsService.findAll();
  }

  @Get(':email')
  findOne(
    @Param('email') email: string,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.screeningsService.findOne(email, request);
  }

  @Levels(LEVELS.ALUNO_ESTUDANTE, LEVELS.PROFISSIONAL_EDUCACAO)
  @Patch(':email')
  update(
    @Param('email') email: string,
    @Body() updateScreeningDto: Partial<CreateScreeningDto>,
  ) {
    return this.screeningsService.update(email, updateScreeningDto);
  }

  @Levels(LEVELS.ALUNO_ESTUDANTE, LEVELS.PROFISSIONAL_EDUCACAO)
  @Delete(':email')
  remove(@Param('email') email: string) {
    return this.screeningsService.remove(email);
  }
}
