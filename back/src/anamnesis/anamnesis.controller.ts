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
import { authorOf } from 'src/form-revisions/revision-author';

@Controller('anamnesis')
export class AnamnesisController {
  constructor(private readonly anamnesisService: AnamnesisService) {}

  @AllowLevels(LEVELS.PROFISSIONAL_NAPNE)
  @Post()
  create(
    @Body() createAnamnesisDto: CreateAnamnesisDto,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.anamnesisService.create(createAnamnesisDto, authorOf(request));
  }

  @AllowLevels(LEVELS.PROFISSIONAL_NAPNE)
  @Get()
  findAll() {
    return this.anamnesisService.findAll();
  }

  @AllowLevels(
    LEVELS.ALUNO_ESTUDANTE,
    LEVELS.PROFISSIONAL_SAUDE,
    LEVELS.PROFISSIONAL_NAPNE,
    LEVELS.PROFESSOR_AEE,
  )
  @Get(':email')
  findOne(
    @Param('email') email: string,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.anamnesisService.findOne(email, request);
  }

  @AllowLevels(LEVELS.PROFISSIONAL_NAPNE)
  @Patch(':email')
  update(
    @Param('email') email: string,
    @Body() updateAnamnesisDto: UpdateAnamnesisDto,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.anamnesisService.update(
      email,
      updateAnamnesisDto,
      authorOf(request),
    );
  }

  @AllowLevels(LEVELS.PROFISSIONAL_NAPNE)
  @Delete(':email')
  remove(@Param('email') email: string) {
    return this.anamnesisService.remove(email);
  }
}
