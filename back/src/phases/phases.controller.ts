import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { PhasesService } from './phases.service';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';
import { ApiBody } from '@nestjs/swagger';
import { Levels } from 'src/auth/decorators/levels.decorator';
import { LEVELS } from 'src/constants';

@Controller('phases')
export class PhasesController {
  constructor(private readonly phasesService: PhasesService) {}

  @Levels(
    LEVELS.ALUNO_ESTUDANTE,
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
  )
  @ApiBody({
    type: CreatePhaseDto,
    description: 'Objeto para criação de um novo tipo de fase',
  })
  @Post()
  create(@Body() createPhaseDto: CreatePhaseDto) {
    return this.phasesService.create(createPhaseDto);
  }

  @Get()
  findAll() {
    return this.phasesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.phasesService.findOne(+id);
  }

  @Levels(
    LEVELS.ALUNO_ESTUDANTE,
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
  )
  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePhaseDto: UpdatePhaseDto) {
    return this.phasesService.update(+id, updatePhaseDto);
  }

  @Levels(
    LEVELS.ALUNO_ESTUDANTE,
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
  )
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.phasesService.remove(+id);
  }
}
