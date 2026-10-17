import { Flag, OmittableField, Section, Text } from 'src/common/dto-fields';
import { LONG_TEXT_MAX_LENGTH } from './aee-plan-fields';
import {
  AeePlanIdentificationDto,
  AeePlanObjectivesDto,
  AeePlanPurposeDto,
  AeePlanSupportsDto,
} from './aee-plan-sections.dto';

// Cada seção enviada substitui a seção inteira, e por isso precisa ir completa,
// com as mesmas regras do cadastro. As seções que não vão no corpo ficam como
// estão. O estudante, o autor e o período letivo não mudam: nenhum dos três é
// aceito aqui.
//
// Não usa PartialType: ele marca cada campo com IsOptional, que também ignora o
// null, e um null chegaria ao Prisma no lugar da seção (500). Aqui só o
// undefined conta como ausente.
export class UpdateAeePlanDto {
  @OmittableField()
  @Section(AeePlanIdentificationDto, 'Identificação do atendimento.')
  identification?: AeePlanIdentificationDto;

  @OmittableField()
  @Text(LONG_TEXT_MAX_LENGTH, 'Embasamento para o atendimento do AEE.')
  basis?: string;

  @OmittableField()
  @Flag('Tem laudo ou diagnóstico. O laudo é facultativo e não tem anexo.')
  has_diagnosis?: boolean;

  @OmittableField()
  @Section(AeePlanSupportsDto, 'Outros apoios e serviços.')
  supports?: AeePlanSupportsDto;

  @OmittableField()
  @Section(AeePlanPurposeDto, 'Finalidade do AEE.')
  purpose?: AeePlanPurposeDto;

  @OmittableField()
  @Section(AeePlanObjectivesDto, 'Objetivos do AEE.')
  objectives?: AeePlanObjectivesDto;

  @OmittableField()
  @Text(
    LONG_TEXT_MAX_LENGTH,
    'Procedimentos e metodologias para avaliação do desenvolvimento do estudante no AEE.',
  )
  evaluation_procedures?: string;
}
