import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { AllowLevels } from 'src/auth/decorators/allow-levels.decorator';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { LEVELS } from 'src/constants';
import { CaseStudiesService } from './case-studies.service';
import { CreateCaseStudyDto } from './dto/create-case-study.dto';
import { UpdateCaseStudyDto } from './dto/update-case-study.dto';

@Controller('case-studies')
export class CaseStudiesController {
  constructor(private readonly caseStudiesService: CaseStudiesService) {}

  // O autor é quem está na sessão, e não um campo do corpo.
  @AllowLevels(LEVELS.PROFISSIONAL_NAPNE)
  @Post()
  create(
    @Body() createCaseStudyDto: CreateCaseStudyDto,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.caseStudiesService.create(createCaseStudyDto, request.user.sub);
  }

  // O estudante entra na lista, e o service o limita ao próprio estudo de caso.
  @AllowLevels(
    LEVELS.ADMIN,
    LEVELS.ALUNO_ESTUDANTE,
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
    LEVELS.PROFISSIONAL_NAPNE,
  )
  @Get(':email')
  findOne(
    @Param('email') email: string,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.caseStudiesService.findOne(email, request);
  }

  // Qualquer Profissional NAPNE edita, não só o autor: o NAPNE atua como equipe.
  @ApiOperation({
    summary: 'Edita o estudo de caso do estudante',
    description:
      'Cada seção enviada substitui a seção inteira, e por isso vai completa; as seções que não vão no corpo ficam como estão. O autor não muda.',
  })
  @AllowLevels(LEVELS.PROFISSIONAL_NAPNE)
  @Patch(':email')
  update(
    @Param('email') email: string,
    @Body() updateCaseStudyDto: UpdateCaseStudyDto,
  ) {
    return this.caseStudiesService.update(email, updateCaseStudyDto);
  }

  @AllowLevels(LEVELS.PROFISSIONAL_NAPNE)
  @Delete(':email')
  remove(@Param('email') email: string) {
    return this.caseStudiesService.remove(email);
  }
}
