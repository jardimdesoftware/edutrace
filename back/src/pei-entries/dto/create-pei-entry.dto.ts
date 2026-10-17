import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches } from 'class-validator';
import { SEMESTER_PATTERN } from 'src/aee-plans/dto/aee-plan-fields';
import { ObjectList, SingleLineText, Text } from 'src/common/dto-fields';
import {
  SUBJECT_MAX_LENGTH,
  SYLLABUS_ADAPTATIONS_MAX_ITEMS,
  TEXT_MAX_LENGTH,
} from './pei-entry-fields';
import { SyllabusAdaptationDto } from './syllabus-adaptation.dto';

// O autor é quem está na sessão, e não um campo do corpo. Todos os campos são
// obrigatórios, mas os textos podem ser a string vazia e a lista pode ser vazia.
export class CreatePeiEntryDto {
  @ApiProperty({
    description: 'E-mail do estudante que tem o registro do PEI.',
    example: 'estudante@example.com',
  })
  @IsEmail({}, { message: 'O campo student_email deve ser um e-mail válido.' })
  student_email: string;

  @ApiProperty({
    description:
      'Semestre do registro, no formato AAAA.S, com S igual a 1 ou 2. Não muda depois de criado.',
    example: '2026.2',
  })
  @IsString({ message: 'semester deve ser uma string.' })
  @Matches(SEMESTER_PATTERN, {
    message:
      'semester deve estar no formato AAAA.S, com S igual a 1 ou 2, como 2026.2.',
  })
  semester: string;

  @SingleLineText(
    SUBJECT_MAX_LENGTH,
    'Disciplina do registro. Não muda depois de criado; a comparação é pelo texto exato, depois de tirar os espaços das pontas.',
  )
  subject: string;

  @Text(TEXT_MAX_LENGTH, 'Objetivos adaptados.')
  adapted_objectives: string;

  @Text(TEXT_MAX_LENGTH, 'Conteúdos priorizados no semestre.')
  prioritized_contents: string;

  @ObjectList(
    SyllabusAdaptationDto,
    SYLLABUS_ADAPTATIONS_MAX_ITEMS,
    'Conteúdo previsto na ementa e a adequação correspondente, um par por linha.',
  )
  syllabus_adaptations: SyllabusAdaptationDto[];

  @Text(TEXT_MAX_LENGTH, 'Metodologias adaptadas.')
  adapted_methodologies: string;

  @Text(TEXT_MAX_LENGTH, 'Atividades avaliativas adaptadas.')
  adapted_assessments: string;

  @Text(TEXT_MAX_LENGTH, 'Recursos adaptados.')
  adapted_resources: string;

  @Text(TEXT_MAX_LENGTH, 'Observações gerais.')
  general_notes: string;
}
