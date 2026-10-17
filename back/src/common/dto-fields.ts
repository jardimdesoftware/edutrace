import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsDefined,
  IsObject,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
  ValidationArguments,
} from 'class-validator';
import { trimText } from 'src/users/dto/student-fields';

// Qualquer caractere fora da categoria Cc, mais a tabulação e as quebras de
// linha, que os textos longos precisam. O PostgreSQL recusa o NUL em TEXT e o
// \u0000 em JSONB, e o erro subiria como 500; os demais controles (escape,
// DEL, os C1) forjam linhas em CSV, log e PDF.
export const TEXT_PATTERN = /^(?:[^\p{Cc}]|[\t\n\r])*$/u;

// Uma data ISO 8601 de verdade tem menos de 40 caracteres, e a fração de
// segundos do formato não tem tamanho máximo: sem este limite, uma data válida
// poderia ocupar o corpo inteiro.
export const DATE_MAX_LENGTH = 40;

// A ValidationPipe prefixa a mensagem de um campo aninhado com o caminho até ele
// (pedagogical_aspects.language.notes deve ter no máximo ...), então a mensagem
// começa pelo nome do campo, e não por "O campo ...".
const named = (text: string) => (args: ValidationArguments) =>
  `${args.property} ${text}`;

// Texto sem espaços nas pontas, com tamanho máximo e sem caracteres de controle
// (a tabulação e as quebras de linha passam). A string vazia é válida: o campo
// precisa estar no corpo, mas o conteúdo pode ficar em branco.
export function Text(maxLength: number, description: string) {
  return applyDecorators(
    ApiProperty({ description, maxLength }),
    IsString({ message: named('deve ser uma string.') }),
    Transform(trimText),
    MaxLength(maxLength, {
      message: named(`deve ter no máximo ${maxLength} caracteres.`),
    }),
    Matches(TEXT_PATTERN, {
      message: named(
        'não pode ter caracteres de controle, exceto tabulação e quebra de linha.',
      ),
    }),
  );
}

export function Flag(description: string) {
  return applyDecorators(
    ApiProperty({ description, type: Boolean }),
    IsBoolean({ message: named('deve ser um booleano.') }),
  );
}

export function IsoDate(description: string) {
  return applyDecorators(
    ApiProperty({ description, example: '2026-10-17' }),
    IsDateString(
      { strict: true },
      { message: named('deve ser uma data ISO 8601, como 2026-10-17.') },
    ),
    MaxLength(DATE_MAX_LENGTH, {
      message: named(`deve ter no máximo ${DATE_MAX_LENGTH} caracteres.`),
    }),
  );
}

// Objeto com os campos fixos de uma seção. O IsObject recusa o array, que o
// ValidateNested aceitaria vazio e gravaria no lugar da seção.
export function Section(type: new () => object, description: string) {
  return applyDecorators(
    ApiProperty({ description, type: () => type }),
    IsDefined({ message: named('é obrigatório.') }),
    IsObject({ message: named('deve ser um objeto.') }),
    ValidateNested(),
    Type(() => type),
  );
}

// Campo que pode faltar no corpo. Só o undefined conta como ausente: o null
// segue para as validações do campo e responde 400, em vez de chegar ao banco.
export function OmittableField() {
  return applyDecorators(
    ApiPropertyOptional(),
    ValidateIf((_object, value) => value !== undefined),
  );
}
