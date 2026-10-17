import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { Flag, OmittableField, Text } from 'src/common/dto-fields';
import {
  SHORT_TEXT_MAX_LENGTH,
  SUBJECT_MAX_LENGTH,
  TEXT_MAX_LENGTH,
  WEEKLY_HOURS_MAX,
} from './aee-plan-fields';

// O curso vem do cadastro do estudante (User.course) e o professor é o autor do
// PAEE, então nenhum dos dois é repetido aqui. O período letivo é do próprio
// PAEE (semester). A carga horária pode faltar no corpo, porque o formulário a
// omite quando está em branco; quando vem, é validada.
export class AeePlanIdentificationDto {
  @Text(SUBJECT_MAX_LENGTH, 'Disciplina do atendimento.')
  subject: string;

  @OmittableField()
  @ApiProperty({
    description:
      'Carga horária semanal do AEE, em horas. Pode faltar no corpo.',
    minimum: 0,
    maximum: WEEKLY_HOURS_MAX,
    example: 4,
  })
  @IsInt({ message: 'weekly_hours deve ser um número inteiro.' })
  @Min(0, { message: 'weekly_hours deve ser no mínimo 0.' })
  @Max(WEEKLY_HOURS_MAX, {
    message: `weekly_hours deve ser no máximo ${WEEKLY_HOURS_MAX}.`,
  })
  weekly_hours?: number;

  @Text(TEXT_MAX_LENGTH, 'Disciplinas em que o estudante está matriculado.')
  enrolled_subjects: string;
}

export class AeePlanSupportsDto {
  @Flag('Recebe apoio de psicologia.')
  psychology: boolean;

  @Flag('Recebe apoio de assistência social.')
  social_assistance: boolean;

  @Flag('Recebe apoio de psicopedagogia.')
  psychopedagogy: boolean;

  @Flag('Recebe acompanhamento da área médica.')
  medical: boolean;

  @Text(SHORT_TEXT_MAX_LENGTH, 'Especialidade médica do acompanhamento.')
  medical_specialty: string;

  @Flag('Faz fisioterapia.')
  physiotherapy: boolean;

  @Flag('Faz fonoaudiologia.')
  speech_therapy: boolean;

  @Flag('Faz equoterapia.')
  equine_therapy: boolean;

  @Flag('Precisa de transcrição de material em braille ou tinta.')
  braille_transcription: boolean;

  @Flag('Conta com tradutor intérprete de Libras.')
  libras_interpreter: boolean;

  @Flag('Conta com professor de Libras.')
  libras_teacher: boolean;

  @Text(SHORT_TEXT_MAX_LENGTH, 'Outros apoios e serviços, internos e externos.')
  other: string;
}

export class AeePlanPurposeDto {
  @Flag(
    'Complementação curricular (deficiência e transtorno do espectro autista).',
  )
  curricular_complementation: boolean;

  @Flag('Suplementação curricular (altas habilidades ou superdotação).')
  curricular_supplementation: boolean;

  @Flag(
    'Adaptação de materiais, serviços e elaboração de recursos para acessibilidade.',
  )
  materials_adaptation: boolean;

  @Flag('Indicação e monitoramento do uso de tecnologias assistivas.')
  assistive_technology: boolean;

  @Flag('Acompanhamento sistemático do estudante.')
  systematic_follow_up: boolean;

  @Text(SHORT_TEXT_MAX_LENGTH, 'Outra finalidade do AEE.')
  other: string;
}

export class AeePlanObjectivesDto {
  @Text(TEXT_MAX_LENGTH, 'Objetivo geral do AEE.')
  general: string;

  @Text(TEXT_MAX_LENGTH, 'Objetivos específicos do AEE.')
  specific: string;
}
