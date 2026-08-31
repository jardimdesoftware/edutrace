import { validate } from 'class-validator';
import {
  IsCpf,
  isValidCpf,
  onlyDigits,
} from 'src/common/validators/is-cpf.validator';

class Alvo {
  @IsCpf()
  cpf: string;

  constructor(cpf: string) {
    this.cpf = cpf;
  }
}

describe('onlyDigits', () => {
  it('should remove the mask of a formatted cpf', () => {
    expect(onlyDigits('012.345.678-90')).toBe('01234567890');
  });

  it('should remove spaces and any other character', () => {
    expect(onlyDigits(' 012 345 678 90 ')).toBe('01234567890');
  });

  it('should return an empty string for null and undefined', () => {
    expect(onlyDigits(null as unknown as string)).toBe('');
    expect(onlyDigits(undefined as unknown as string)).toBe('');
  });
});

describe('isValidCpf', () => {
  it('should accept a cpf with correct check digits', () => {
    expect(isValidCpf('01234567890')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('11144477735')).toBe(true);
  });

  it('should accept the same cpf with mask', () => {
    expect(isValidCpf('012.345.678-90')).toBe(true);
  });

  it('should reject a cpf with wrong check digits', () => {
    expect(isValidCpf('01234567891')).toBe(false);
    expect(isValidCpf('52998224724')).toBe(false);
  });

  it('should reject repeated digit sequences', () => {
    const sequencias = [
      '00000000000',
      '11111111111',
      '22222222222',
      '33333333333',
      '44444444444',
      '55555555555',
      '66666666666',
      '77777777777',
      '88888888888',
      '99999999999',
    ];

    sequencias.forEach((cpf) => expect(isValidCpf(cpf)).toBe(false));
  });

  it('should reject values that are not eleven digits', () => {
    expect(isValidCpf('0123456789')).toBe(false);
    expect(isValidCpf('012345678901')).toBe(false);
    expect(isValidCpf('')).toBe(false);
  });

  it('should reject letters', () => {
    expect(isValidCpf('abcdefghijk')).toBe(false);
  });

  it('should reject null and undefined', () => {
    expect(isValidCpf(null as unknown as string)).toBe(false);
    expect(isValidCpf(undefined as unknown as string)).toBe(false);
  });
});

describe('IsCpf', () => {
  it('should not report an error for a valid cpf', async () => {
    const erros = await validate(new Alvo('01234567890'));

    expect(erros).toHaveLength(0);
  });

  it('should report an error for an invalid cpf', async () => {
    const erros = await validate(new Alvo('01234567891'));

    expect(erros).toHaveLength(1);
    expect(erros[0].constraints).toHaveProperty('isCpf');
  });

  it('should report an error when the value is not a string', async () => {
    const erros = await validate(new Alvo(12345678901 as unknown as string));

    expect(erros).toHaveLength(1);
  });
});
