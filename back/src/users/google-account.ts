// A conta criada pelo login com Google nasce com este prefixo no lugar do CPF
// (createGoogleStudentUser em users.service.ts), porque o Google não informa o
// CPF. Enquanto o prefixo existir, a pessoa ainda não cadastrou CPF nem senha.
export const GOOGLE_CPF_PREFIX = 'google:';

export function hasPendingGoogleRegistration(user: { cpf: string }): boolean {
  return user.cpf.startsWith(GOOGLE_CPF_PREFIX);
}
