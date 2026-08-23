import {
  MIN_SECRET_KEY_LENGTH,
  validateSecretKey,
} from 'src/common/validate-secret-key';

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
});
