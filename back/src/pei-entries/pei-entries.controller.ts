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
import { Throttle } from '@nestjs/throttler';
import { AllowLevels } from 'src/auth/decorators/allow-levels.decorator';
import { AuthenticatedRequest } from 'src/comments/types/express';
import {
  ParsePositiveIdPipe,
  PositiveIdParam,
} from 'src/common/parse-positive-id.pipe';
import { LEVELS } from 'src/constants';
import { CreatePeiEntryDto } from './dto/create-pei-entry.dto';
import { UpdatePeiEntryDto } from './dto/update-pei-entry.dto';
import { PeiEntriesService } from './pei-entries.service';
import { PEI_ENTRY_CREATE_THROTTLE } from './pei-entries.throttle';

@Controller('pei-entries')
export class PeiEntriesController {
  constructor(private readonly peiEntriesService: PeiEntriesService) {}

  // O autor é quem está na sessão, e não um campo do corpo.
  @ApiOperation({
    summary: 'Cria o registro do PEI de uma disciplina em um semestre',
    description:
      'Um registro por estudante, semestre e disciplina entre os ativos; o repetido responde 409. Cada estudante tem no máximo 300 registros ativos, e o seguinte responde 409. Cada usuário cria até 60 registros por hora.',
  })
  @AllowLevels(LEVELS.PROFISSIONAL_EDUCACAO)
  @Throttle(PEI_ENTRY_CREATE_THROTTLE)
  @Post()
  create(
    @Body() createPeiEntryDto: CreatePeiEntryDto,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.peiEntriesService.create(createPeiEntryDto, request.user.sub);
  }

  // O estudante entra na lista, e o service o limita aos próprios registros.
  @ApiOperation({
    summary: 'Lista os registros do PEI do estudante',
    description:
      'Do semestre mais recente para o mais antigo e, no mesmo semestre, pela disciplina. Só os registros não excluídos; a lista é vazia quando o estudante não tem registro.',
  })
  @AllowLevels(
    LEVELS.ADMIN,
    LEVELS.ALUNO_ESTUDANTE,
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
    LEVELS.PROFISSIONAL_NAPNE,
  )
  @Get(':email')
  findByStudent(
    @Param('email') email: string,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.peiEntriesService.findByStudent(email, request);
  }

  // Só o autor do registro edita, e o service compara com a sessão.
  @ApiOperation({
    summary: 'Edita o registro do PEI',
    description:
      'Cada campo enviado substitui o valor inteiro (a lista de pares inclusive); os que não vão no corpo ficam como estão. O estudante, o semestre, a disciplina e o autor não mudam: para corrigir o semestre ou a disciplina, exclua o registro e crie outro.',
  })
  @ApiParam({ name: 'id', type: Number })
  @AllowLevels(LEVELS.PROFISSIONAL_EDUCACAO)
  @Patch(':id')
  update(
    @PositiveIdParam('id', ParsePositiveIdPipe) id: number,
    @Body() updatePeiEntryDto: UpdatePeiEntryDto,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.peiEntriesService.update(
      id,
      updatePeiEntryDto,
      request.user.sub,
    );
  }

  // O autor exclui; o registro sem autor (a conta dele foi excluída) é excluído
  // por qualquer Profissional da Educação, e o service decide.
  @ApiOperation({
    summary: 'Exclui o registro do PEI',
    description:
      'Exclusão lógica: o registro sai das listagens e do relatório e continua no banco. Só o autor exclui, ou qualquer Profissional da Educação quando a conta do autor foi excluída e o registro ficou sem autor.',
  })
  @ApiParam({ name: 'id', type: Number })
  @AllowLevels(LEVELS.PROFISSIONAL_EDUCACAO)
  @Delete(':id')
  remove(
    @PositiveIdParam('id', ParsePositiveIdPipe) id: number,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.peiEntriesService.remove(id, request.user.sub);
  }
}
