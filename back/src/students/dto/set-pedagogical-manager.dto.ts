import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateBy,
  ValidateIf,
} from 'class-validator';
import { IsCpf, onlyDigits } from 'src/common/validators/is-cpf.validator';
import { trimText } from 'src/users/dto/student-fields';

export const MANAGER_KINDS = {
  SERVER: 'SERVER',
  EXTERNAL: 'EXTERNAL',
  NONE: 'NONE',
} as const;

export type ManagerKind = (typeof MANAGER_KINDS)[keyof typeof MANAGER_KINDS];

export const EXTERNAL_MANAGER_NAME_MAX_LENGTH = 150;

// Qualquer caractere fora das categorias Cc (quebra de linha, tabulação, NUL,
// DEL e os controles C1), Cf (formato, como o U+202E que inverte o sentido do
// texto), Zl (U+2028) e Zp (U+2029). O nome entra em tabela, CSV e log, onde um
// caractere de controle quebra a linha ou forja uma entrada, e um de formato
// esconde ou reordena o que está escrito.
const EXTERNAL_MANAGER_NAME_PATTERN = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+$/u;

// Telefone fixo (10 dígitos) ou celular (11), com o DDD e sem o código do país.
const PHONE_PATTERN = /^\d{10,11}$/;

// Maior valor da coluna INTEGER. Acima dele o banco responderia 500.
const INT4_MAX = 2147483647;

function digitsOnly({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? onlyDigits(value) : value;
}

// O campo de um tipo só é validado quando o tipo o pede ou quando ele veio no
// corpo. No segundo caso a validação falha, e o corpo misturado, como SERVER com
// nome, responde 400 em vez de ter o campo ignorado em silêncio.
function OnlyForKind(kind: ManagerKind) {
  return applyDecorators(
    ValidateIf(
      (dto: SetPedagogicalManagerDto, value: unknown) =>
        dto.kind === kind || value !== undefined,
    ),
    ValidateBy({
      name: 'onlyForKind',
      validator: {
        validate: (value: unknown, args) =>
          value === undefined ||
          (args?.object as SetPedagogicalManagerDto).kind === kind,
        defaultMessage: (args) =>
          `O campo ${args?.property} só pode ser informado com kind ${kind}.`,
      },
    }),
  );
}

export class SetPedagogicalManagerDto {
  @ApiProperty({
    description:
      'SERVER vincula um Profissional da Educação, Profissional NAPNE ou Professor do AEE (user_id). EXTERNAL grava uma pessoa externa (name, phone e cpf). NONE remove o responsável.',
    enum: Object.values(MANAGER_KINDS),
    example: MANAGER_KINDS.SERVER,
  })
  @IsIn(Object.values(MANAGER_KINDS), {
    message: 'O campo kind deve ser SERVER, EXTERNAL ou NONE.',
  })
  kind: ManagerKind;

  @ApiProperty({
    description:
      'Id do servidor, de nível Profissional da Educação, Profissional NAPNE ou Professor do AEE. Só com kind SERVER.',
    example: 12,
    required: false,
  })
  @OnlyForKind(MANAGER_KINDS.SERVER)
  @IsInt({ message: 'O campo user_id deve ser um inteiro.' })
  @Min(1, { message: 'O campo user_id deve ser no mínimo 1.' })
  @Max(INT4_MAX, { message: `O campo user_id deve ser no máximo ${INT4_MAX}.` })
  user_id?: number;

  @ApiProperty({
    description:
      'Nome completo do responsável externo, gravado sem espaços nas pontas. Só com kind EXTERNAL.',
    example: 'Maria da Silva',
    required: false,
    maxLength: EXTERNAL_MANAGER_NAME_MAX_LENGTH,
  })
  @OnlyForKind(MANAGER_KINDS.EXTERNAL)
  @IsString({ message: 'O campo name deve ser uma string.' })
  @Transform(trimText)
  @IsNotEmpty({ message: 'O campo name não deve estar vazio.' })
  @MaxLength(EXTERNAL_MANAGER_NAME_MAX_LENGTH, {
    message: `O campo name deve ter no máximo ${EXTERNAL_MANAGER_NAME_MAX_LENGTH} caracteres.`,
  })
  @Matches(EXTERNAL_MANAGER_NAME_PATTERN, {
    message:
      'O campo name não deve ter caracteres de controle ou de formatação.',
  })
  name?: string;

  @ApiProperty({
    description:
      'Telefone do responsável externo, com DDD e com ou sem máscara. É gravado só com os dígitos (10 ou 11). Só com kind EXTERNAL.',
    example: '(81) 99999-8888',
    required: false,
  })
  @OnlyForKind(MANAGER_KINDS.EXTERNAL)
  @IsString({ message: 'O campo phone deve ser uma string.' })
  @Transform(digitsOnly)
  @Matches(PHONE_PATTERN, {
    message: 'O campo phone deve ter 10 ou 11 dígitos, com o DDD.',
  })
  phone?: string;

  @ApiProperty({
    description:
      'CPF do responsável externo, com ou sem máscara. É gravado com os 11 dígitos. Só com kind EXTERNAL.',
    example: '01234567890',
    required: false,
  })
  @OnlyForKind(MANAGER_KINDS.EXTERNAL)
  @IsString({ message: 'O campo cpf deve ser uma string.' })
  @Transform(digitsOnly)
  @IsCpf({ message: 'O campo cpf deve ser um CPF válido.' })
  cpf?: string;
}
