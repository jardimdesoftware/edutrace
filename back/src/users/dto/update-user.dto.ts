import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { LEVELS } from 'src/constants';
import {
  COURSE_MAX_LENGTH,
  COURSE_PATTERN,
  ENROLLMENT_NUMBER_MAX_LENGTH,
  ENROLLMENT_NUMBER_PATTERN,
  normalizeEnrollmentNumber,
  trimText,
} from './student-fields';

// UsersService.update grava só o nome, o nível, a matrícula e o curso. O DTO
// declara só esses campos, para que e-mail, CPF e os demais campos do cadastro
// sejam recusados com 400, e não aceitos com 200 sem alterar nada.
export class UpdateUserDto {
  @ApiProperty({
    description: 'Nome do usuário',
    example: 'Luizin',
  })
  @IsOptional()
  @IsString({ message: 'O campo full_name deve ser uma string.' })
  full_name?: string;

  @ApiProperty({
    description: 'Apenas quem pode fazer essa atualização é o ADMIN.',
  })
  @ValidateIf((dto: UpdateUserDto) => dto.id_level !== undefined)
  @IsInt({ message: 'O campo id_level deve ser um inteiro.' })
  @IsIn(Object.values(LEVELS), {
    message: 'O campo id_level deve ser um nível de acesso existente.',
  })
  readonly id_level?: number;

  @ApiProperty({
    description:
      'Correção da matrícula, gravada sem espaços nas pontas e em caixa alta. Só para conta de nível Estudante/Família.',
    example: '20261TADS0012',
    required: false,
    maxLength: ENROLLMENT_NUMBER_MAX_LENGTH,
  })
  @ValidateIf((dto: UpdateUserDto) => dto.enrollment_number !== undefined)
  @IsNotEmpty({ message: 'O campo enrollment_number não deve estar vazio.' })
  @IsString({ message: 'O campo enrollment_number deve ser uma string.' })
  @Transform(normalizeEnrollmentNumber)
  @MaxLength(ENROLLMENT_NUMBER_MAX_LENGTH, {
    message: `O campo enrollment_number deve ter no máximo ${ENROLLMENT_NUMBER_MAX_LENGTH} caracteres.`,
  })
  @Matches(ENROLLMENT_NUMBER_PATTERN, {
    message:
      'O campo enrollment_number deve ter apenas letras, números, ponto, hífen e barra.',
  })
  enrollment_number?: string;

  @ApiProperty({
    description: 'Correção do curso. Só para conta de nível Estudante/Família.',
    example: 'Análise e Desenvolvimento de Sistemas',
    required: false,
    maxLength: COURSE_MAX_LENGTH,
  })
  @ValidateIf((dto: UpdateUserDto) => dto.course !== undefined)
  @IsNotEmpty({ message: 'O campo course não deve estar vazio.' })
  @IsString({ message: 'O campo course deve ser uma string.' })
  @Transform(trimText)
  @MaxLength(COURSE_MAX_LENGTH, {
    message: `O campo course deve ter no máximo ${COURSE_MAX_LENGTH} caracteres.`,
  })
  @Matches(COURSE_PATTERN, {
    message: 'O campo course não deve ter caracteres de controle.',
  })
  course?: string;
}
