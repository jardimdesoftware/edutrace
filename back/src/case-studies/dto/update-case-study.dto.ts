import {
  OmittableField,
  Section,
  TEXT_MAX_LENGTH,
  Text,
} from './case-study-fields';
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

// Cada seção enviada substitui a seção inteira, e por isso precisa ir completa,
// com as mesmas regras do cadastro. As seções que não vão no corpo ficam como
// estão. O estudante e o autor não mudam: nenhum dos dois é aceito aqui.
//
// Não usa PartialType: ele marca cada campo com IsOptional, que também ignora o
// null, e um null chegaria ao Prisma no lugar da seção (500). Aqui só o
// undefined conta como ausente.
export class UpdateCaseStudyDto {
  @OmittableField()
  @Section(CaseStudyIdentificationDto, 'Identificação do estudante.')
  identification?: CaseStudyIdentificationDto;

  @OmittableField()
  @Section(CaseStudyGeneralInfoDto, 'Informações gerais.')
  general_info?: CaseStudyGeneralInfoDto;

  @OmittableField()
  @Section(CaseStudySchoolHistoryDto, 'Histórico escolar.')
  school_history?: CaseStudySchoolHistoryDto;

  @OmittableField()
  @Section(CaseStudyPedagogicalAspectsDto, 'Aspectos pedagógicos.')
  pedagogical_aspects?: CaseStudyPedagogicalAspectsDto;

  @OmittableField()
  @Section(CaseStudyBehavioralSocialDto, 'Aspectos comportamentais e sociais.')
  behavioral_social?: CaseStudyBehavioralSocialDto;

  @OmittableField()
  @Text(TEXT_MAX_LENGTH, 'Potencialidades e interesses.')
  potentialities_interests?: string;

  @OmittableField()
  @Text(TEXT_MAX_LENGTH, 'Barreiras para aprendizagem e participação.')
  barriers?: string;

  @OmittableField()
  @Section(CaseStudyResourcesStrategiesDto, 'Recursos e estratégias.')
  resources_strategies?: CaseStudyResourcesStrategiesDto;

  @OmittableField()
  @Section(CaseStudyPeiRecommendationsDto, 'Recomendações para o PEI.')
  pei_recommendations?: CaseStudyPeiRecommendationsDto;

  @OmittableField()
  @Section(CaseStudyAeeOpinionDto, 'Parecer do professor do AEE.')
  aee_opinion?: CaseStudyAeeOpinionDto;
}
