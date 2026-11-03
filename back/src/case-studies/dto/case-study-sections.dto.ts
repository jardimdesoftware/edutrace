import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import {
  Flag,
  IsoDate,
  OmittableField,
  Section,
  Text,
} from 'src/common/dto-fields';
import {
  AGE_MAX,
  GRADE_MAX_LENGTH,
  OPINION_MAX_LENGTH,
  SHORT_TEXT_MAX_LENGTH,
  TEXT_MAX_LENGTH,
} from './case-study-fields';

// O curso vem do cadastro do estudante (User.course) e o professor do AEE é o
// autor do estudo de caso, então nenhum dos dois é repetido aqui. A idade e as
// duas datas podem faltar no corpo, porque o formulário as omite quando estão
// em branco; quando vêm, são validadas.
export class CaseStudyIdentificationDto {
  @Text(GRADE_MAX_LENGTH, 'Ano ou série do estudante.')
  grade: string;

  @OmittableField()
  @ApiProperty({
    description: 'Idade do estudante, em anos. Pode faltar no corpo.',
    minimum: 0,
    maximum: AGE_MAX,
    example: 17,
  })
  @IsInt({ message: 'age deve ser um número inteiro.' })
  @Min(0, { message: 'age deve ser no mínimo 0.' })
  @Max(AGE_MAX, { message: `age deve ser no máximo ${AGE_MAX}.` })
  age?: number;

  @OmittableField()
  @IsoDate('Data do estudo de caso. Pode faltar no corpo.')
  date?: string;
}

export class CaseStudyFollowUpsDto {
  @Flag('Tem acompanhamento de saúde.')
  health: boolean;

  @Flag('Faz terapias.')
  therapies: boolean;

  @Text(SHORT_TEXT_MAX_LENGTH, 'Outros acompanhamentos realizados.')
  other: string;
}

export class CaseStudyGeneralInfoDto {
  @OmittableField()
  @Text(TEXT_MAX_LENGTH, 'Diagnóstico do estudante. Pode faltar no corpo.')
  diagnosis?: string;

  @Flag(
    'Laudo médico apresentado. O laudo é facultativo e não tem anexo no sistema.',
  )
  has_medical_report: boolean;

  @Section(CaseStudyFollowUpsDto, 'Acompanhamentos realizados.')
  follow_ups: CaseStudyFollowUpsDto;
}

export class CaseStudySchoolHistoryDto {
  @Text(SHORT_TEXT_MAX_LENGTH, 'Tempo de permanência na instituição.')
  time_at_institution: string;

  @Text(TEXT_MAX_LENGTH, 'Atendimentos especializados anteriores.')
  previous_specialized_services: string;

  @Text(TEXT_MAX_LENGTH, 'Principais dificuldades no contexto escolar.')
  main_difficulties: string;

  @Text(TEXT_MAX_LENGTH, 'Potencialidades observadas.')
  observed_potentialities: string;
}

export class CaseStudyBehavioralSocialDto {
  @Text(TEXT_MAX_LENGTH, 'Interação com os colegas.')
  peer_interaction: string;

  @Text(TEXT_MAX_LENGTH, 'Interação com os professores.')
  teacher_interaction: string;

  @Text(TEXT_MAX_LENGTH, 'Participação nas atividades.')
  participation: string;

  @Text(TEXT_MAX_LENGTH, 'Comportamentos que interferem na aprendizagem.')
  interfering_behaviors: string;
}

export class CaseStudyResourcesStrategiesDto {
  @Text(TEXT_MAX_LENGTH, 'Recursos de acessibilidade.')
  accessibility_resources: string;

  @Text(TEXT_MAX_LENGTH, 'Estratégias pedagógicas.')
  pedagogical_strategies: string;

  @Text(TEXT_MAX_LENGTH, 'Adaptações curriculares necessárias.')
  curricular_adaptations: string;

  @Text(TEXT_MAX_LENGTH, 'Justificativa para a adaptação curricular.')
  adaptation_justification: string;
}

export class CaseStudyPeiRecommendationsDto {
  @Text(TEXT_MAX_LENGTH, 'Objetivos prioritários.')
  priority_objectives: string;

  @Text(TEXT_MAX_LENGTH, 'Encaminhamentos.')
  referrals: string;

  @Text(TEXT_MAX_LENGTH, 'Orientações aos professores.')
  teacher_guidance: string;
}

export class CaseStudyAeeOpinionDto {
  @Text(OPINION_MAX_LENGTH, 'Parecer do professor do AEE.')
  opinion: string;

  @OmittableField()
  @IsoDate('Data do parecer. Pode faltar no corpo.')
  date?: string;
}
