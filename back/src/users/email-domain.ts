export const DISCENTE_EMAIL_DOMAIN = 'discente.ifpe.edu.br';

export const DISCENTE_ROLES_MESSAGE =
  'Contas com e-mail @discente.ifpe.edu.br só podem ter o papel Estudante/Família.';

export function isDiscenteEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${DISCENTE_EMAIL_DOMAIN}`);
}

export const INSTITUTIONAL_EMAIL_DOMAIN = 'ifpe.edu.br';

// O claim hd do Google só existe em conta do Workspace do domínio, que o IFPE
// administra, então terceiros não o obtêm com uma Conta Google comum. O vínculo
// automático exige hd institucional e e-mail dentro desse mesmo domínio.
export function isInstitutionalHostedAccount(
  email: string,
  hostedDomain?: string,
): boolean {
  const hd = hostedDomain?.trim().toLowerCase();
  const domain = email.trim().toLowerCase().split('@')[1];

  if (!hd || !domain) {
    return false;
  }

  const institutionalHd =
    hd === INSTITUTIONAL_EMAIL_DOMAIN ||
    hd.endsWith(`.${INSTITUTIONAL_EMAIL_DOMAIN}`);

  return institutionalHd && (domain === hd || domain.endsWith(`.${hd}`));
}
