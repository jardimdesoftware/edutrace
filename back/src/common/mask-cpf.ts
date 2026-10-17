const FULLY_MASKED_CPF = '***';

export function maskCpf(cpf: string): string {
  const digits = (cpf ?? '').replace(/\D/g, '');

  // Só formatamos o que reconhecemos como CPF. Qualquer outro valor é ocultado
  // por completo para nunca devolver um dado que não soubemos interpretar.
  if (digits.length !== 11) {
    return FULLY_MASKED_CPF;
  }

  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

// Mascara também o CPF do responsável pedagógico externo, que sai na resposta
// do estudante com a mesma máscara do CPF dele.
type MaskableUser = { cpf: string; external_manager_cpf?: string | null };

export function maskUserCpf<T extends MaskableUser>(user: T): T {
  const masked = { ...user, cpf: maskCpf(user.cpf) };

  return typeof user.external_manager_cpf === 'string'
    ? { ...masked, external_manager_cpf: maskCpf(user.external_manager_cpf) }
    : masked;
}

export function maskUsersCpf<T extends MaskableUser>(users: T[]): T[] {
  return users.map((user) => maskUserCpf(user));
}
