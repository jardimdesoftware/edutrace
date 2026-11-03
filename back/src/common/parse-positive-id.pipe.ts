import {
  BadRequestException,
  ExecutionContext,
  Injectable,
  PipeTransform,
  createParamDecorator,
} from '@nestjs/common';
import type { Request } from 'express';

// O maior INTEGER do PostgreSQL. Um id acima dele não existe, e o banco o
// recusaria com o P2020.
const MAX_ID = 2147483647;

// Inteiro positivo escrito por inteiro: sem sinal, sem zero à esquerda, sem
// expoente, sem base, sem espaço e com no máximo 10 dígitos.
const CANONICAL_ID = /^[1-9]\d{0,9}$/;

const INVALID_ID_MESSAGE =
  'O identificador deve ser um número inteiro positivo.';

// Valida o texto do parâmetro antes de converter. O Number e o + aceitam 1e3,
// 0x10, 0b10000 e " 16", e o ParseIntPipe ainda deixa passar -1, 0 e 01, então
// converter primeiro é agir sobre um id que não foi o enviado.
@Injectable()
export class ParsePositiveIdPipe implements PipeTransform<unknown, number> {
  transform(value: unknown): number {
    if (
      typeof value !== 'string' ||
      !CANONICAL_ID.test(value) ||
      Number(value) > MAX_ID
    ) {
      throw new BadRequestException(INVALID_ID_MESSAGE);
    }

    return Number(value);
  }
}

// O ValidationPipe global (transform: true) converte com o + todo @Param
// declarado como number antes dos pipes da rota, e o texto original se perde.
// O parâmetro de decorator personalizado passa por ele sem conversão, então o
// pipe recebe o texto como veio no caminho: @PositiveIdParam('id',
// ParsePositiveIdPipe) id: number.
export const PositiveIdParam = createParamDecorator(
  (name: string, context: ExecutionContext): unknown =>
    context.switchToHttp().getRequest<Request>().params[name],
);
