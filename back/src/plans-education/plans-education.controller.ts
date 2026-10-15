import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
} from '@nestjs/common';
import { PlansEducationService } from './plans-education.service';
import { CreatePlansEducationDto } from './dto/create-plans-education.dto';
import { UpdatePlansEducationDto } from './dto/update-plans-education.dto';
import { AllowLevels } from 'src/auth/decorators/allow-levels.decorator';
import { LEVELS } from 'src/constants';
import { AuthenticatedRequest } from 'src/comments/types/express';

@Controller('plans-education')
export class PlansEducationController {
  constructor(private readonly plansEducationService: PlansEducationService) {}

  @AllowLevels(LEVELS.ADMIN, LEVELS.PROFISSIONAL_EDUCACAO)
  @Post()
  create(
    @Body() createPlansEducationDto: CreatePlansEducationDto,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.plansEducationService.create(
      createPlansEducationDto,
      request.user,
    );
  }

  @AllowLevels(
    LEVELS.ADMIN,
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
  )
  @Get()
  findAll() {
    return this.plansEducationService.findAll();
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
    return this.plansEducationService.findOne(email, request);
  }

  @AllowLevels(LEVELS.ADMIN, LEVELS.PROFISSIONAL_EDUCACAO)
  @Patch(':email')
  update(@Param('email') email: string, @Body() data: UpdatePlansEducationDto) {
    return this.plansEducationService.update(email, data);
  }

  @AllowLevels(LEVELS.ADMIN, LEVELS.PROFISSIONAL_EDUCACAO)
  @Delete(':email')
  remove(@Param('email') email: string) {
    return this.plansEducationService.remove(email);
  }
}
