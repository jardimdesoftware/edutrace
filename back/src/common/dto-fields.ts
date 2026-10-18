import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsDefined,
  IsNotEmpty,
  IsObject,
  IsString,
  Matches,
  ValidateBy,
  ValidateIf,
  ValidateNested,
  ValidationArguments,
} from 'class-validator';
import { trimText } from 'src/users/dto/student-fields';

// Sem os espaços das pontas e na forma composta (NFC). A comparação de um texto
// que decide a unicidade é pelos pontos de código, então a mesma palavra digitada
// com a letra e o acento combinante separados (NFD) e com a letra composta (NFC)
// teria a mesma aparência e valeria como dois textos.
function trimAndNormalize({ value }: { value: unknown }): unknown {
  const trimmed = trimText({ value });
  return typeof trimmed === 'string' ? trimmed.normalize('NFC') : trimmed;
}

// Qualquer caractere fora das categorias Cc (controle) e Cs (surrogate solto),
// mais a tabulação e as quebras de linha, que os textos longos precisam. O
// PostgreSQL recusa o NUL em TEXT e o \u0000 em JSONB, e o erro subiria como
// 500; os demais controles (escape, DEL, os C1) forjam linhas em CSV, log e PDF.
// O surrogate solto (um \uD800 sem o par) também faz o JSONB recusar o texto,
// e o par de verdade (um emoji) é um ponto de código só e não entra na
// categoria Cs.
export const TEXT_PATTERN = /^(?:[^\p{Cc}\p{Cs}]|[\t\n\r])*$/u;

// Uma linha só: nenhum caractere das categorias Cc (inclusive a tabulação e as
// quebras de linha), Cf (formato, como o U+200B, o U+202E que inverte o sentido
// do texto, o U+FEFF e o hífen condicional U+00AD), Cs (surrogate solto), Zl
// (U+2028) e Zp (U+2029, que o JavaScript trata como fim de linha). Para o nome
// que entra em tabela, PDF, CSV e log, onde uma quebra no meio forja uma linha e
// um caractere de formato esconde ou reordena o que está escrito.
export const SINGLE_LINE_PATTERN = /^[^\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]*$/u;

// Uma data ISO 8601 de verdade tem menos de 40 caracteres, e a fração de
// segundos do formato não tem tamanho máximo: sem este limite, uma data válida
// poderia ocupar o corpo inteiro.
export const DATE_MAX_LENGTH = 40;

// A ValidationPipe prefixa a mensagem de um campo aninhado com o caminho até ele
// (pedagogical_aspects.language.notes deve ter no máximo ...), então a mensagem
// começa pelo nome do campo, e não por "O campo ...".
const named = (text: string) => (args: ValidationArguments) =>
  `${args.property} ${text}`;

// Tamanho máximo em unidades UTF-16, o que o .length do JavaScript conta e o
// maxLength do textarea do front aplica. O MaxLength do class-validator (a
// função isLength) conta o par surrogate (um emoji) como 1 e o seletor de
// variação (U+FE0E e U+FE0F) como 0, então 2000 emojis com seletor passavam num
// limite de 2000 e ocupavam 6000 unidades, uns 14 kb. A chave da constraint
// segue sendo maxLength.
export function MaxUtf16Length(maxLength: number) {
  return ValidateBy(
    {
      name: 'maxLength',
      constraints: [maxLength],
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && value.length <= maxLength,
      },
    },
    { message: named(`deve ter no máximo ${maxLength} caracteres.`) },
  );
}

// Texto sem espaços nas pontas, com tamanho máximo e sem caracteres de controle
// (a tabulação e as quebras de linha passam). A string vazia é válida: o campo
// precisa estar no corpo, mas o conteúdo pode ficar em branco.
export function Text(maxLength: number, description: string) {
  return applyDecorators(
    ApiProperty({ description, maxLength }),
    IsString({ message: named('deve ser uma string.') }),
    Transform(trimText),
    MaxUtf16Length(maxLength),
    Matches(TEXT_PATTERN, {
      message: named(
        'não pode ter caracteres de controle, exceto tabulação e quebra de linha.',
      ),
    }),
  );
}

// Text que não pode ficar em branco: depois do trim, precisa ter ao menos um
// caractere. O campo que identifica um item (o conteúdo da ementa) usa este.
export function RequiredText(maxLength: number, description: string) {
  return applyDecorators(
    Text(maxLength, description),
    ApiProperty({ description, maxLength, minLength: 1 }),
    IsNotEmpty({ message: named('não pode ficar em branco.') }),
  );
}

// Texto de uma linha só, sem espaços nas pontas, em NFC, não vazio e com tamanho
// máximo. Diferente do Text, recusa também a tabulação, a quebra de linha e os
// caracteres de formato.
export function SingleLineText(maxLength: number, description: string) {
  return applyDecorators(
    ApiProperty({ description, minLength: 1, maxLength }),
    IsString({ message: named('deve ser uma string.') }),
    Transform(trimAndNormalize),
    IsNotEmpty({ message: named('não pode ficar em branco.') }),
    MaxUtf16Length(maxLength),
    Matches(SINGLE_LINE_PATTERN, {
      message: named(
        'não pode ter quebra de linha nem caracteres de controle, de formatação ou inválidos.',
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
    MaxUtf16Length(DATE_MAX_LENGTH),
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

// Lista de objetos com campos fixos e no máximo maxItems itens. O ValidateNested
// sozinho deixa passar o item que não é objeto (texto, número, null), e o Prisma
// o gravaria no JSONB; o IsObject({ each: true }) recusa cada um. O IsArray
// recusa o objeto e o texto no lugar da lista.
export function ObjectList(
  type: new () => object,
  maxItems: number,
  description: string,
) {
  return applyDecorators(
    ApiProperty({ description, type: () => [type], maxItems }),
    IsDefined({ message: named('é obrigatório.') }),
    IsArray({ message: named('deve ser uma lista.') }),
    ArrayMaxSize(maxItems, {
      message: named(`deve ter no máximo ${maxItems} itens.`),
    }),
    IsObject({ each: true, message: named('deve ter só objetos.') }),
    ValidateNested({ each: true }),
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
