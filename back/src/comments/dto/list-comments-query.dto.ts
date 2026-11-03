import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CommentType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsString,
  Matches,
  ValidateBy,
} from 'class-validator';
import {
  MaxCombiningMarkRun,
  MaxUtf16Length,
  OmittableField,
} from 'src/common/dto-fields';
import { CANONICAL_ID, MAX_ID } from 'src/common/parse-positive-id.pipe';
import {
  COMBINING_MARKS_MAX_RUN,
  COMMENT_AUTHOR_AREAS,
  COMMENT_LIST_LIMIT,
  COMMENT_SEARCH_MAX_LENGTH,
} from 'src/constants';
import { trimText } from 'src/users/dto/student-fields';

const SEARCH_PATTERN = /^[^\p{Cc}\p{Cs}]*$/u;

const ISO_DATE_TIME =
  /^([1-9]\d{3})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

function toCanonicalInteger({ value }: { value: unknown }): unknown {
  return typeof value === 'string' && CANONICAL_ID.test(value)
    ? Number(value)
    : value;
}

function toBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true') {
    return true;
  }

  return value === 'false' ? false : value;
}

function IntegerInRange(min: number, max: number, message: string) {
  return applyDecorators(
    Transform(toCanonicalInteger),
    ValidateBy({
      name: 'isIntegerInRange',
      constraints: [min, max],
      validator: {
        validate: (value: unknown) =>
          typeof value === 'number' &&
          Number.isInteger(value) &&
          value >= min &&
          value <= max,
        defaultMessage: () => message,
      },
    }),
  );
}

function isStrictIsoDateTime(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const match = ISO_DATE_TIME.exec(value);
  if (!match) {
    return false;
  }

  const [, year, month, day] = match;
  const daysInMonth = new Date(
    Date.UTC(Number(year), Number(month), 0),
  ).getUTCDate();

  return (
    Number(day) <= daysInMonth && /^\d{4}-/.test(new Date(value).toISOString())
  );
}

function StrictIsoDateTime(message: string) {
  return ValidateBy({
    name: 'isStrictIsoDateTime',
    validator: {
      validate: isStrictIsoDateTime,
      defaultMessage: () => message,
    },
  });
}

const dateTimeMessage = (field: string) =>
  `${field} deve ser uma data e hora ISO 8601 com fuso, como 2026-10-17T03:00:00.000Z.`;

export class ListCommentsQueryDto {
  @ApiPropertyOptional({
    description: `Busca por trecho no texto da anotação ou no nome do autor, sem diferenciar maiúscula nem acento. Até ${COMMENT_SEARCH_MAX_LENGTH} caracteres, sem caracteres de controle e com no máximo ${COMBINING_MARKS_MAX_RUN} acentos ou marcas seguidos; vazio não filtra.`,
    maxLength: COMMENT_SEARCH_MAX_LENGTH,
  })
  @OmittableField()
  @IsString({ message: 'q deve ser uma string.' })
  @Transform(trimText)
  @MaxUtf16Length(COMMENT_SEARCH_MAX_LENGTH)
  @Matches(SEARCH_PATTERN, {
    message: 'q não pode ter caracteres de controle.',
  })
  @MaxCombiningMarkRun(
    COMBINING_MARKS_MAX_RUN,
    `q não pode ter mais de ${COMBINING_MARKS_MAX_RUN} acentos ou marcas seguidos.`,
  )
  q?: string;

  @ApiPropertyOptional({
    description: 'Id do autor. Inteiro positivo escrito por inteiro.',
    type: Number,
  })
  @OmittableField()
  @IntegerInRange(1, MAX_ID, 'author deve ser um número inteiro positivo.')
  author?: number;

  @ApiPropertyOptional({
    description:
      'Nível atual do autor: 1 (Administrador), 3 (Educação), 4 (Saúde) ou 5 (NAPNE).',
    enum: COMMENT_AUTHOR_AREAS,
    type: Number,
  })
  @OmittableField()
  @Transform(toCanonicalInteger)
  @IsIn(COMMENT_AUTHOR_AREAS, { message: 'area deve ser 1, 3, 4 ou 5.' })
  area?: number;

  @ApiPropertyOptional({
    description: 'Tipo do registro.',
    enum: CommentType,
  })
  @OmittableField()
  @IsEnum(CommentType, {
    message: `type deve ser ${Object.values(CommentType).join(' ou ')}.`,
  })
  type?: CommentType;

  @ApiPropertyOptional({
    description:
      'Início do período, inclusive: data e hora ISO 8601 com fuso. Filtra created_at >= from.',
    example: '2026-10-17T03:00:00.000Z',
  })
  @OmittableField()
  @StrictIsoDateTime(dateTimeMessage('from'))
  from?: string;

  @ApiPropertyOptional({
    description:
      'Fim do período, exclusive: data e hora ISO 8601 com fuso. Filtra created_at < to.',
    example: '2026-10-18T03:00:00.000Z',
  })
  @OmittableField()
  @StrictIsoDateTime(dateTimeMessage('to'))
  to?: string;

  @ApiPropertyOptional({
    description:
      'true devolve só as anotações com ao menos uma edição; false não filtra.',
    type: Boolean,
  })
  @OmittableField()
  @Transform(toBoolean)
  @IsBoolean({ message: 'edited deve ser true ou false.' })
  edited?: boolean;

  @ApiPropertyOptional({
    description:
      'Id do último item da página anterior (next_cursor). Devolve só as anotações com id menor.',
    type: Number,
  })
  @OmittableField()
  @IntegerInRange(1, MAX_ID, 'cursor deve ser um número inteiro positivo.')
  cursor?: number;

  @ApiPropertyOptional({
    description: `Tamanho da página, de 1 a ${COMMENT_LIST_LIMIT.MAX}.`,
    default: COMMENT_LIST_LIMIT.DEFAULT,
    minimum: 1,
    maximum: COMMENT_LIST_LIMIT.MAX,
    type: Number,
  })
  @OmittableField()
  @IntegerInRange(
    1,
    COMMENT_LIST_LIMIT.MAX,
    `limit deve ser um número inteiro de 1 a ${COMMENT_LIST_LIMIT.MAX}.`,
  )
  limit?: number;
}
