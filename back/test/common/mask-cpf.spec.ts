import { maskCpf, maskUserCpf, maskUsersCpf } from 'src/common/mask-cpf';

describe('maskCpf', () => {
  it('should keep only the six middle digits of a valid cpf', () => {
    expect(maskCpf('12345678910')).toBe('***.456.789-**');
  });

  it('should normalize a cpf that already comes formatted', () => {
    expect(maskCpf('123.456.789-10')).toBe('***.456.789-**');
  });

  it('should fully mask an empty string', () => {
    expect(maskCpf('')).toBe('***');
  });

  it('should fully mask a cpf with less than eleven digits', () => {
    expect(maskCpf('1234567891')).toBe('***');
  });

  it('should fully mask a cpf with more than eleven digits', () => {
    expect(maskCpf('123456789101')).toBe('***');
  });

  it('should fully mask a value without digits', () => {
    expect(maskCpf('abcdefghijk')).toBe('***');
  });

  it('should fully mask a null or undefined value', () => {
    expect(maskCpf(null as unknown as string)).toBe('***');
    expect(maskCpf(undefined as unknown as string)).toBe('***');
  });
});

describe('maskUserCpf', () => {
  it('should mask the cpf without changing the other fields', () => {
    const user = { id: 1, full_name: 'Test User', cpf: '12345678910' };

    expect(maskUserCpf(user)).toEqual({
      id: 1,
      full_name: 'Test User',
      cpf: '***.456.789-**',
    });
  });

  it('should not mutate the original object', () => {
    const user = { id: 1, cpf: '12345678910' };

    maskUserCpf(user);

    expect(user.cpf).toBe('12345678910');
  });
});

describe('maskUsersCpf', () => {
  it('should mask the cpf of every user in the list', () => {
    const users = [
      { id: 1, cpf: '12345678910' },
      { id: 2, cpf: '98765432100' },
    ];

    expect(maskUsersCpf(users)).toEqual([
      { id: 1, cpf: '***.456.789-**' },
      { id: 2, cpf: '***.654.321-**' },
    ]);
  });

  it('should return an empty list when there is no user', () => {
    expect(maskUsersCpf([])).toEqual([]);
  });
});
