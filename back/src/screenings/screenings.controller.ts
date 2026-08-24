import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { ScreeningsService } from './screenings.service';
import { CreateScreeningDto } from './dto/create-screening.dto';
import { Levels } from 'src/auth/decorators/levels.decorator';
import { LEVELS } from 'src/constants';

@Controller('screenings')
export class ScreeningsController {
  constructor(private readonly screeningsService: ScreeningsService) {}

  @Levels(LEVELS.ALUNO_ESTUDANTE, LEVELS.PROFISSIONAL_EDUCACAO)
  @Post()
  create(@Body() createScreeningDto: CreateScreeningDto) {
    return this.screeningsService.create(createScreeningDto);
  }

  @Get()
  findAll() {
    return this.screeningsService.findAll();
  }

  @Get(':email')
  findOne(@Param('email') email: string) {
    return this.screeningsService.findOne(email);
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
