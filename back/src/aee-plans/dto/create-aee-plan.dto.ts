import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches } from 'class-validator';
import { Flag, Section, Text } from 'src/common/dto-fields';
import { LONG_TEXT_MAX_LENGTH, SEMESTER_PATTERN } from './aee-plan-fields';
import {
  AeePlanIdentificationDto,
  AeePlanObjectivesDto,
  AeePlanPurposeDto,
  AeePlanSupportsDto,
} from './aee-plan-sections.dto';

export class CreateAeePlanDto {
  @ApiProperty({
    description: 'E-mail do estudante que tem o PAEE.',
    example: 'estudante@example.com',
  })
  @IsEmail({}, { message: 'O campo student_email deve ser um e-mail válido.' })
  student_email: string;

  @ApiProperty({
    description:
      'Período letivo do PAEE, no formato AAAA.S, com S igual a 1 ou 2. Não muda depois de criado.',
    example: '2026.2',
  })
  @IsString({ message: 'semester deve ser uma string.' })
  @Matches(SEMESTER_PATTERN, {
    message:
      'semester deve estar no formato AAAA.S, com S igual a 1 ou 2, como 2026.2.',
  })
  semester: string;

  @Section(AeePlanIdentificationDto, 'Identificação do atendimento.')
  identification: AeePlanIdentificationDto;

  @Text(LONG_TEXT_MAX_LENGTH, 'Embasamento para o atendimento do AEE.')
  basis: string;

  @Flag('Tem laudo ou diagnóstico. O laudo é facultativo e não tem anexo.')
  has_diagnosis: boolean;

  @Section(AeePlanSupportsDto, 'Outros apoios e serviços.')
  supports: AeePlanSupportsDto;

  @Section(AeePlanPurposeDto, 'Finalidade do AEE.')
  purpose: AeePlanPurposeDto;

  @Section(AeePlanObjectivesDto, 'Objetivos do AEE.')
  objectives: AeePlanObjectivesDto;

  @Text(
    LONG_TEXT_MAX_LENGTH,
    'Procedimentos e metodologias para avaliação do desenvolvimento do estudante no AEE.',
  )
  evaluation_procedures: string;
}
