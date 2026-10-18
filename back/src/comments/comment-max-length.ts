import type { CommentType } from '@prisma/client';
import { ValidateBy, ValidationArguments } from 'class-validator';
import { COMBINING_MARKS_MAX_RUN, COMMENT_MAX_LENGTH } from 'src/constants';

export const COMMENT_MAX_LENGTH_CEILING = Math.max(
  ...Object.values(COMMENT_MAX_LENGTH),
);

export const COMMENT_CONTROL_CHARACTERS_MESSAGE =
  'O campo comment não pode ter caracteres de controle, exceto tabulação e quebra de linha.';

export const COMMENT_COMBINING_MARKS_MESSAGE = `O campo comment não pode ter mais de ${COMBINING_MARKS_MAX_RUN} acentos ou marcas seguidos.`;

export function commentTooLongMessage(limit: number): string {
  return `O campo comment deve ter no máximo ${limit} caracteres.`;
}

export function commentMaxLengthOf(type: unknown): number {
  if (type === undefined) {
    return COMMENT_MAX_LENGTH.NOTE;
  }

  return typeof type === 'string' && Object.hasOwn(COMMENT_MAX_LENGTH, type)
    ? COMMENT_MAX_LENGTH[type as CommentType]
    : COMMENT_MAX_LENGTH_CEILING;
}

export function CommentMaxLength(
  limitOf: (dto: Record<string, unknown>) => number,
) {
  const limitFor = (args: ValidationArguments) =>
    limitOf(args.object as Record<string, unknown>);

  return ValidateBy({
    name: 'maxLength',
    validator: {
      validate: (value: unknown, args: ValidationArguments) =>
        typeof value === 'string' && value.length <= limitFor(args),
      defaultMessage: (args: ValidationArguments) =>
        commentTooLongMessage(limitFor(args)),
    },
  });
}
