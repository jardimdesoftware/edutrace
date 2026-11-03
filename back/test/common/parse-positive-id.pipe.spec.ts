import { BadRequestException } from '@nestjs/common';
import { ParsePositiveIdPipe } from 'src/common/parse-positive-id.pipe';

describe('ParsePositiveIdPipe', () => {
  const pipe = new ParsePositiveIdPipe();

  it.each([
    ['1', 1],
    ['16', 16],
    ['1000', 1000],
    ['2147483647', 2147483647],
  ])('should turn the canonical text %s into the number %d', (text, id) => {
    expect(pipe.transform(text)).toBe(id);
  });

  // Cada texto abaixo vira um inteiro positivo com o Number ou com o +, que é
  // o motivo de o pipe validar o texto antes de converter.
  it.each([
    ['1e3', 'notação científica'],
    ['0x10', 'hexadecimal'],
    ['0b10000', 'binário'],
    ['0o20', 'octal'],
    [' 16', 'espaço antes'],
    ['16 ', 'espaço depois'],
    ['+16', 'sinal de mais'],
    ['16.0', 'casa decimal'],
    ['1_000', 'separador'],
    ['Infinity', 'infinito'],
    ['٣', 'dígito não ASCII'],
    ['16\n', 'quebra de linha depois'],
  ])('should reject %j, written as %s', (text) => {
    expect(() => pipe.transform(text)).toThrow(BadRequestException);
  });

  it.each(['', '0', '-1', '01', '00', 'abc', '12abc', '1.5'])(
    'should reject %j, which is not a positive integer without leading zero',
    (text) => {
      expect(() => pipe.transform(text)).toThrow(BadRequestException);
    },
  );

  it('should reject the first number above the INTEGER of PostgreSQL, which the database would refuse', () => {
    expect(() => pipe.transform('2147483648')).toThrow(BadRequestException);
  });

  it.each(['9999999999', '10000000000', '99999999999999999999'])(
    'should reject %s, which has more digits than an INTEGER holds',
    (text) => {
      expect(() => pipe.transform(text)).toThrow(BadRequestException);
    },
  );

  // O ValidationPipe global converte o parâmetro declarado como number antes
  // dos pipes da rota, e a conversão apaga a diferença entre 1e3 e 1000. Um
  // número chegando aqui é o uso errado, e o pipe fecha em vez de aceitar.
  it.each([16, 1000, NaN, null, undefined, {}, ['16']])(
    'should reject the value %p, which is not a text',
    (value) => {
      expect(() => pipe.transform(value)).toThrow(BadRequestException);
    },
  );

  it('should name the problem in the message', () => {
    expect.assertions(1);
    try {
      pipe.transform('1e3');
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({
        message: 'O identificador deve ser um número inteiro positivo.',
      });
    }
  });
});
