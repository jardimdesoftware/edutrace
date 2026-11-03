import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { IsCpf, onlyDigits } from 'src/common/validators/is-cpf.validator';
import { LEVELS } from 'src/constants';
import { sortRoles } from '../roles';
import { IsRoles } from './is-roles.validator';
import {
  COURSE_MAX_LENGTH,
  COURSE_PATTERN,
  ENROLLMENT_NUMBER_MAX_LENGTH,
  ENROLLMENT_NUMBER_PATTERN,
  normalizeEnrollmentNumber,
  trimText,
} from './student-fields';

// Sem roles o cadastro cria estudante (UsersController.create). Matrícula e
// curso só são cobrados nesse caso; a recusa de quem não é estudante e envia os
// campos fica no UsersService.
function isStudent(dto: CreateUserDto): boolean {
  const roles = dto.roles ?? [LEVELS.ALUNO_ESTUDANTE];
  return roles.length === 1 && roles[0] === LEVELS.ALUNO_ESTUDANTE;
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
    description:
      'Papéis de acesso do usuário criado, em lista. Administrador (1) e Estudante/Família (2) ficam sozinhos; os profissionais (3, 4, 5 e 6) combinam entre si. Sem o campo, a conta é de estudante.',
    example: [3, 6],
    default: [2],
    required: false,
    type: [Number],
  })
  @IsOptional({ message: 'O campo roles é opcional.' })
  @IsRoles()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) && value.every((role) => Number.isInteger(role))
      ? sortRoles(value as number[])
      : value,
  )
  roles?: number[];

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
