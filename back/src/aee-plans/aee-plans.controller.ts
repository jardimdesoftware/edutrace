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
import { ApiOperation, ApiParam } from '@nestjs/swagger';
import { AllowLevels } from 'src/auth/decorators/allow-levels.decorator';
import { AuthenticatedRequest } from 'src/comments/types/express';
import {
  ParsePositiveIdPipe,
  PositiveIdParam,
} from 'src/common/parse-positive-id.pipe';
import { LEVELS } from 'src/constants';
import { AeePlansService } from './aee-plans.service';
import { CreateAeePlanDto } from './dto/create-aee-plan.dto';
import { UpdateAeePlanDto } from './dto/update-aee-plan.dto';

@Controller('aee-plans')
export class AeePlansController {
  constructor(private readonly aeePlansService: AeePlansService) {}

  // O autor é quem está na sessão, e não um campo do corpo.
  @AllowLevels(LEVELS.PROFISSIONAL_NAPNE)
  @Post()
  create(
    @Body() createAeePlanDto: CreateAeePlanDto,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.aeePlansService.create(createAeePlanDto, request.user.sub);
  }

  // O estudante entra na lista, e o service o limita aos próprios PAEE.
  @ApiOperation({
    summary: 'Lista os PAEE do estudante',
    description:
      'Do período letivo mais recente para o mais antigo. A lista é vazia quando o estudante não tem PAEE.',
  })
  @AllowLevels(
    LEVELS.ADMIN,
    LEVELS.ALUNO_ESTUDANTE,
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
    LEVELS.PROFISSIONAL_NAPNE,
    LEVELS.PROFESSOR_AEE,
  )
  @Get(':email')
  findByStudent(
    @Param('email') email: string,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.aeePlansService.findByStudent(email, request);
  }

  // Qualquer Profissional NAPNE edita, não só o autor: o NAPNE atua como equipe.
  @ApiOperation({
    summary: 'Edita o PAEE',
    description:
      'Cada seção enviada substitui a seção inteira, e por isso vai completa; as seções que não vão no corpo ficam como estão. O autor, o estudante e o período letivo não mudam.',
  })
  @ApiParam({ name: 'id', type: Number })
  @AllowLevels(LEVELS.PROFISSIONAL_NAPNE)
  @Patch(':id')
  update(
    @PositiveIdParam('id', ParsePositiveIdPipe) id: number,
    @Body() updateAeePlanDto: UpdateAeePlanDto,
  ) {
    return this.aeePlansService.update(id, updateAeePlanDto);
  }

  @ApiParam({ name: 'id', type: Number })
  @AllowLevels(LEVELS.PROFISSIONAL_NAPNE)
  @Delete(':id')
  remove(@PositiveIdParam('id', ParsePositiveIdPipe) id: number) {
    return this.aeePlansService.remove(id);
  }
}
