export const MIN_SECRET_KEY_LENGTH = 32;

export function validateSecretKey(secret = process.env.SECRET_KEY): void {
  if (!secret) {
    throw new Error('SECRET_KEY environment variable is not set');
  }

  if (secret.length < MIN_SECRET_KEY_LENGTH) {
    throw new Error(
      `SECRET_KEY environment variable must have at least ${MIN_SECRET_KEY_LENGTH} characters, got ${secret.length}`,
    );
  }
}
