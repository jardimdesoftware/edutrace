import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MIN_SECRET_KEY_LENGTH,
  validateSecretKey,
} from 'src/common/validate-secret-key';

// Valor de SECRET_KEY em um arquivo de exemplo versionado.
function exampleSecret(file: string): string {
  const line = readFileSync(join(__dirname, '..', '..', '..', file), 'utf8')
    .split('\n')
    .find((entry) => entry.startsWith('SECRET_KEY='));

  return (line ?? '').replace('SECRET_KEY=', '').trim().replace(/^"|"$/g, '');
}

describe('validateSecretKey', () => {
  const validSecret = 'a'.repeat(MIN_SECRET_KEY_LENGTH);
  const originalSecret = process.env.SECRET_KEY;

  afterEach(() => {
    // Atribuir undefined a process.env grava a string "undefined".
    if (originalSecret === undefined) {
      delete process.env.SECRET_KEY;
      return;
    }

    process.env.SECRET_KEY = originalSecret;
  });

  it('should accept a secret with the minimum length', () => {
    expect(() => validateSecretKey(validSecret)).not.toThrow();
  });

  it('should accept a secret longer than the minimum length', () => {
    expect(() => validateSecretKey(`${validSecret}extra`)).not.toThrow();
  });

  it('should throw when the secret is not set', () => {
    expect(() => validateSecretKey(undefined)).toThrow(
      'SECRET_KEY environment variable is not set',
    );
  });

  it('should throw when the secret is an empty string', () => {
    expect(() => validateSecretKey('')).toThrow(
      'SECRET_KEY environment variable is not set',
    );
  });

  it('should throw when the secret is shorter than the minimum length', () => {
    const shortSecret = 'abcdefghijklmnopq';

    expect(() => validateSecretKey(shortSecret)).toThrow(
      `SECRET_KEY environment variable must have at least ${MIN_SECRET_KEY_LENGTH} characters, got ${shortSecret.length}`,
    );
  });

  it('should read from process.env when no argument is given', () => {
    process.env.SECRET_KEY = 'curta';
    expect(() => validateSecretKey()).toThrow('at least');

    process.env.SECRET_KEY = validSecret;
    expect(() => validateSecretKey()).not.toThrow();

    delete process.env.SECRET_KEY;
    expect(() => validateSecretKey()).toThrow('is not set');
  });

  // O valor de exemplo está publicado no repositório: quem o conhece assina
  // tokens de sessão aceitos pela API.
  it('should refuse the example value', () => {
    expect(() =>
      validateSecretKey(
        'troque_por_uma_chave_segura_com_32_caracteres_ou_mais',
      ),
    ).toThrow('SECRET_KEY environment variable is set to the example value');
  });

  it.each([
    '.env.production.example',
    '.env.development.example',
    'back/.env.local.example',
  ])('should refuse the SECRET_KEY of %s', (file) => {
    const secret = exampleSecret(file);

    expect(secret.length).toBeGreaterThanOrEqual(MIN_SECRET_KEY_LENGTH);
    expect(() => validateSecretKey(secret)).toThrow('example value');
  });
});
