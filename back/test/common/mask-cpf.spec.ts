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

  it('should mask the cpf of the external pedagogical manager too', () => {
    const user = {
      id: 1,
      cpf: '12345678910',
      external_manager_cpf: '98765432100',
    };

    expect(maskUserCpf(user)).toEqual({
      id: 1,
      cpf: '***.456.789-**',
      external_manager_cpf: '***.654.321-**',
    });
    expect(user.external_manager_cpf).toBe('98765432100');
  });

  it('should keep the external cpf null when the student has none', () => {
    const user = { id: 1, cpf: '12345678910', external_manager_cpf: null };

    expect(maskUserCpf(user)).toEqual({
      id: 1,
      cpf: '***.456.789-**',
      external_manager_cpf: null,
    });
  });

  it('should not add the external cpf to an object that does not have it', () => {
    expect(maskUserCpf({ id: 1, cpf: '12345678910' })).not.toHaveProperty(
      'external_manager_cpf',
    );
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

  it('should mask the external cpf of every user in the list', () => {
    expect(
      maskUsersCpf([
        { id: 1, cpf: '12345678910', external_manager_cpf: '98765432100' },
        { id: 2, cpf: '98765432100', external_manager_cpf: null },
      ]),
    ).toEqual([
      { id: 1, cpf: '***.456.789-**', external_manager_cpf: '***.654.321-**' },
      { id: 2, cpf: '***.654.321-**', external_manager_cpf: null },
    ]);
  });

  it('should return an empty list when there is no user', () => {
    expect(maskUsersCpf([])).toEqual([]);
  });
});
