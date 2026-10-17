import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import { Section, TEXT_MAX_LENGTH, Text } from './case-study-fields';
import { CaseStudyPedagogicalAspectsDto } from './case-study-pedagogical.dto';
import {
  CaseStudyAeeOpinionDto,
  CaseStudyBehavioralSocialDto,
  CaseStudyGeneralInfoDto,
  CaseStudyIdentificationDto,
  CaseStudyPeiRecommendationsDto,
  CaseStudyResourcesStrategiesDto,
  CaseStudySchoolHistoryDto,
} from './case-study-sections.dto';

export class CreateCaseStudyDto {
  @ApiProperty({
    description: 'E-mail do estudante que tem o estudo de caso.',
    example: 'estudante@example.com',
  })
  @IsEmail({}, { message: 'O campo student_email deve ser um e-mail válido.' })
  student_email: string;

  @Section(CaseStudyIdentificationDto, 'Identificação do estudante.')
  identification: CaseStudyIdentificationDto;

  @Section(CaseStudyGeneralInfoDto, 'Informações gerais.')
  general_info: CaseStudyGeneralInfoDto;

  @Section(CaseStudySchoolHistoryDto, 'Histórico escolar.')
  school_history: CaseStudySchoolHistoryDto;

  @Section(CaseStudyPedagogicalAspectsDto, 'Aspectos pedagógicos.')
  pedagogical_aspects: CaseStudyPedagogicalAspectsDto;

  @Section(CaseStudyBehavioralSocialDto, 'Aspectos comportamentais e sociais.')
  behavioral_social: CaseStudyBehavioralSocialDto;

  @Text(TEXT_MAX_LENGTH, 'Potencialidades e interesses.')
  potentialities_interests: string;

  @Text(TEXT_MAX_LENGTH, 'Barreiras para aprendizagem e participação.')
  barriers: string;

  @Section(CaseStudyResourcesStrategiesDto, 'Recursos e estratégias.')
  resources_strategies: CaseStudyResourcesStrategiesDto;

  @Section(CaseStudyPeiRecommendationsDto, 'Recomendações para o PEI.')
  pei_recommendations: CaseStudyPeiRecommendationsDto;

  @Section(CaseStudyAeeOpinionDto, 'Parecer do professor do AEE.')
  aee_opinion: CaseStudyAeeOpinionDto;
}
