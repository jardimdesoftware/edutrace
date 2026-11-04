import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsCpf, onlyDigits } from 'src/common/validators/is-cpf.validator';
import { COURSE_NOT_IN_LIST_MESSAGE, COURSES } from 'src/users/courses';
import {
  ENROLLMENT_NUMBER_MAX_LENGTH,
  ENROLLMENT_NUMBER_PATTERN,
  normalizeEnrollmentNumber,
} from 'src/users/dto/student-fields';

export class CompleteRegistrationDto {
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
    description: 'Senha escolhida pelo usuário com no mínimo 8 caracteres.',
    example: 'senhaSegura123',
    minLength: 8,
  })
  @IsNotEmpty({ message: 'O campo password não deve estar vazio.' })
  @IsString({ message: 'O campo password deve ser uma string' })
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres' })
  password: string;

  @ApiProperty({
    description:
      'Matrícula do estudante, gravada sem espaços nas pontas e em caixa alta.',
    example: '20261TADS0012',
    maxLength: ENROLLMENT_NUMBER_MAX_LENGTH,
  })
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
  enrollment_number: string;

  @ApiProperty({
    description: 'Curso do estudante, um dos cursos da lista.',
    enum: COURSES,
  })
  @IsIn(COURSES, { message: COURSE_NOT_IN_LIST_MESSAGE })
  course: (typeof COURSES)[number];
}
