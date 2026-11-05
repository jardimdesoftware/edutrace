export const DISCENTE_EMAIL_DOMAIN = 'discente.ifpe.edu.br';

export const DISCENTE_ROLES_MESSAGE =
  'Contas com e-mail @discente.ifpe.edu.br só podem ter o papel Estudante/Família.';

export function isDiscenteEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${DISCENTE_EMAIL_DOMAIN}`);
}
