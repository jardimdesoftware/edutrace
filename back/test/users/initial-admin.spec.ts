import { readInitialAdmin } from 'src/users/initial-admin';

const valid = {
  ADMIN_EMAIL: 'admin@escola.example',
  ADMIN_CPF: '012.345.678-90',
  ADMIN_PASSWORD: 'Kx9!vQ2#mW7z',
};

describe('readInitialAdmin', () => {
  it('should read the e-mail, the CPF digits and the password', () => {
    expect(readInitialAdmin(valid)).toEqual({
      email: 'admin@escola.example',
      cpf: '01234567890',
      password: 'Kx9!vQ2#mW7z',
    });
  });

  it.each([
    ['ADMIN_EMAIL', { ...valid, ADMIN_EMAIL: undefined }],
    ['ADMIN_EMAIL', { ...valid, ADMIN_EMAIL: 'nao e email' }],
    ['ADMIN_CPF', { ...valid, ADMIN_CPF: undefined }],
    ['ADMIN_CPF', { ...valid, ADMIN_CPF: '01234567891' }],
    ['ADMIN_PASSWORD', { ...valid, ADMIN_PASSWORD: '123' }],
    // admin123 está na lista de senhas comuns que o sistema recusa.
    ['ADMIN_PASSWORD', { ...valid, ADMIN_PASSWORD: 'admin123' }],
    ['ADMIN_PASSWORD', { ...valid, ADMIN_PASSWORD: 'Password123' }],
  ])('should refuse an invalid %s', (variable, env) => {
    expect(() => readInitialAdmin(env)).toThrow(variable);
  });

  it('should name every invalid variable at once', () => {
    expect(() =>
      readInitialAdmin({ ADMIN_PASSWORD: valid.ADMIN_PASSWORD }),
    ).toThrow(/ADMIN_EMAIL.*ADMIN_CPF/);
  });
});
