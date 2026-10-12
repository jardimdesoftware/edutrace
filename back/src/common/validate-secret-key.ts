export const MIN_SECRET_KEY_LENGTH = 32;

// Valores de SECRET_KEY dos arquivos de exemplo versionados
// (.env.production.example, .env.development.example e
// back/.env.local.example). Estão publicados no repositório: com eles, qualquer
// pessoa assina tokens de sessão que a API aceita.
const EXAMPLE_SECRET_KEYS = [
  'troque_por_uma_chave_segura_com_32_caracteres_ou_mais',
];

export function validateSecretKey(secret = process.env.SECRET_KEY): void {
  if (!secret) {
    throw new Error('SECRET_KEY environment variable is not set');
  }

  if (secret.length < MIN_SECRET_KEY_LENGTH) {
    throw new Error(
      `SECRET_KEY environment variable must have at least ${MIN_SECRET_KEY_LENGTH} characters, got ${secret.length}`,
    );
  }

  if (EXAMPLE_SECRET_KEYS.includes(secret)) {
    throw new Error(
      'SECRET_KEY environment variable is set to the example value',
    );
  }
}
