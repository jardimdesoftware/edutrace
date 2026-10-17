import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { IsCpf, onlyDigits } from 'src/common/validators/is-cpf.validator';
import { LEVELS } from 'src/constants';
import {
  COURSE_MAX_LENGTH,
  COURSE_PATTERN,
  ENROLLMENT_NUMBER_MAX_LENGTH,
  ENROLLMENT_NUMBER_PATTERN,
  normalizeEnrollmentNumber,
  trimText,
} from './student-fields';

// Sem id_level o cadastro cria estudante (UsersController.create). Matrícula e
// curso só são cobrados nesse caso; a recusa de quem não é estudante e envia os
// campos fica no UsersService.
function isStudent(dto: CreateUserDto): boolean {
  return (dto.id_level ?? LEVELS.ALUNO_ESTUDANTE) === LEVELS.ALUNO_ESTUDANTE;
}

export class CreateUserDto {
  @ApiProperty({
    description: 'Nome do usuário',
    example: 'Luizin',
  })
  @IsNotEmpty({ message: 'O campo full_name não deve estar vazio.' })
  @IsString({ message: 'O campo full_name deve ser uma string.' })
  full_name: string;

  @ApiProperty({
    description: 'CPF, com ou sem máscara. É gravado sempre com os 11 dígitos.',
    example: '01234567890',
  })
  @IsNotEmpty({ message: 'O campo CPF não deve estar vazio.' })
  @IsString({ message: 'O campo CPF deve ser uma string.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? onlyDigits(value) : value,
  )
  @IsCpf({ message: 'O campo CPF deve ser um CPF válido.' })
  cpf: string;

  @ApiProperty({
    description: 'Email do usuário',
    example: 'luizin@hotmail.com',
  })
  @IsNotEmpty({ message: 'O campo email não deve estar vazio.' })
  @IsEmail({}, { message: 'O campo email deve ser um e-mail válido.' })
  email: string;

  @ApiProperty({
    description: 'Filiação do usuário',
    example: 'Filiação',
    required: false,
  })
  @IsOptional({ message: 'O campo affliation é opcional.' })
  @IsString({ message: 'O campo affliation deve ser uma string.' })
  affliation?: string;

  @ApiProperty({
    description: 'Nível de acesso do usuário criado pelo administrador.',
    default: 2,
    required: false,
  })
  @IsOptional({ message: 'O campo id_level é opcional.' })
  @IsNumber({}, { message: 'O campo id_level deve ser um número.' })
  @IsInt({ message: 'O campo id_level deve ser um inteiro.' })
  @IsIn(Object.values(LEVELS), {
    message: 'O campo id_level deve ser um nível de acesso existente.',
  })
  id_level?: number;

  @ApiProperty({
    description:
      'Matrícula do estudante, gravada sem espaços nas pontas e em caixa alta. Obrigatória no nível Estudante/Família e recusada nos demais.',
    example: '20261TADS0012',
    required: false,
    maxLength: ENROLLMENT_NUMBER_MAX_LENGTH,
  })
  @ValidateIf(isStudent)
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
    description:
      'Curso do estudante. Obrigatório no nível Estudante/Família e recusado nos demais.',
    example: 'Análise e Desenvolvimento de Sistemas',
    required: false,
    maxLength: COURSE_MAX_LENGTH,
  })
  @ValidateIf(isStudent)
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
