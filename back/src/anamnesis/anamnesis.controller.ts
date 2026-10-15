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
import { AnamnesisService } from './anamnesis.service';
import { CreateAnamnesisDto } from './dto/create-anamnesis.dto';
import { UpdateAnamnesisDto } from './dto/update-anamnesis.dto';
import { AllowLevels } from 'src/auth/decorators/allow-levels.decorator';
import { LEVELS } from 'src/constants';
import { AuthenticatedRequest } from 'src/comments/types/express';

@Controller('anamnesis')
export class AnamnesisController {
  constructor(private readonly anamnesisService: AnamnesisService) {}

  @AllowLevels(LEVELS.ADMIN, LEVELS.PROFISSIONAL_SAUDE)
  @Post()
  create(@Body() createAnamnesisDto: CreateAnamnesisDto) {
    return this.anamnesisService.create(createAnamnesisDto);
  }

  @AllowLevels(
    LEVELS.ADMIN,
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
  )
  @Get()
  findAll() {
    return this.anamnesisService.findAll();
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
    return this.anamnesisService.findOne(email, request);
  }

  @AllowLevels(LEVELS.ADMIN, LEVELS.PROFISSIONAL_SAUDE)
  @Patch(':email')
  update(
    @Param('email') email: string,
    @Body() updateAnamnesisDto: UpdateAnamnesisDto,
  ) {
    return this.anamnesisService.update(email, updateAnamnesisDto);
  }

  @AllowLevels(LEVELS.ADMIN, LEVELS.PROFISSIONAL_SAUDE)
  @Delete(':email')
  remove(@Param('email') email: string) {
    return this.anamnesisService.remove(email);
  }
}
