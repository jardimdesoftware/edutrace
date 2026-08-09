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

export function maskUserCpf<T extends { cpf: string }>(user: T): T {
  return { ...user, cpf: maskCpf(user.cpf) };
}

export function maskUsersCpf<T extends { cpf: string }>(users: T[]): T[] {
  return users.map((user) => maskUserCpf(user));
}
