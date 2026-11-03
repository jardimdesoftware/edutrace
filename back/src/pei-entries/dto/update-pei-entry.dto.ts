import { ObjectList, OmittableField, Text } from 'src/common/dto-fields';
import {
  SYLLABUS_ADAPTATIONS_MAX_ITEMS,
  TEXT_MAX_LENGTH,
} from './pei-entry-fields';
import { SyllabusAdaptationDto } from './syllabus-adaptation.dto';

// Cada campo enviado substitui o valor inteiro, a lista de pares inclusive, e por
// isso a lista vai completa. Os campos que não vão no corpo ficam como estão.
// O estudante, o semestre, a disciplina e o autor não mudam: nenhum dos quatro é
// aceito aqui, e quem errou o semestre ou a disciplina exclui o registro e cria
// outro.
//
// Não usa PartialType: ele marca cada campo com IsOptional, que também ignora o
// null, e um null chegaria ao Prisma no lugar do valor (500). Aqui só o
// undefined conta como ausente.
export class UpdatePeiEntryDto {
  @OmittableField()
  @Text(TEXT_MAX_LENGTH, 'Objetivos adaptados.')
  adapted_objectives?: string;

  @OmittableField()
  @Text(TEXT_MAX_LENGTH, 'Conteúdos priorizados no semestre.')
  prioritized_contents?: string;

  @OmittableField()
  @ObjectList(
    SyllabusAdaptationDto,
    SYLLABUS_ADAPTATIONS_MAX_ITEMS,
    'Conteúdo previsto na ementa e a adequação correspondente, um par por linha.',
  )
  syllabus_adaptations?: SyllabusAdaptationDto[];

  @OmittableField()
  @Text(TEXT_MAX_LENGTH, 'Metodologias adaptadas.')
  adapted_methodologies?: string;

  @OmittableField()
  @Text(TEXT_MAX_LENGTH, 'Atividades avaliativas adaptadas.')
  adapted_assessments?: string;

  @OmittableField()
  @Text(TEXT_MAX_LENGTH, 'Recursos adaptados.')
  adapted_resources?: string;

  @OmittableField()
  @Text(TEXT_MAX_LENGTH, 'Observações gerais.')
  general_notes?: string;
}
