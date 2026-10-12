import { isEmail } from 'class-validator';
import { isCommonPassword } from '../auth/compromised-password.service';
import { isValidCpf, onlyDigits } from '../common/validators/is-cpf.validator';

// Mesmo mínimo da troca de senha (UpdateProfileDto).
const MIN_PASSWORD_LENGTH = 8;

export type InitialAdmin = { email: string; cpf: string; password: string };

// Dados do administrador inicial que o seed cria quando o banco não tem nenhum
// administrador. E-mail e CPF vêm do ambiente, e não do código, e a senha passa
// pelas mesmas regras das senhas escolhidas no sistema (ASVS 5.0, 6.2.1 e
// 6.2.4). Os imports são relativos porque o seed roda com ts-node, sem o alias
// src/.
export function readInitialAdmin(
  env: Record<string, string | undefined>,
): InitialAdmin {
  const email = env.ADMIN_EMAIL?.trim() ?? '';
  const cpf = env.ADMIN_CPF ?? '';
  const password = env.ADMIN_PASSWORD ?? '';
  const errors: string[] = [];

  if (!isEmail(email)) {
    errors.push('ADMIN_EMAIL ausente ou fora do formato de e-mail');
  }
  if (!isValidCpf(cpf)) {
    errors.push('ADMIN_CPF ausente ou inválido');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(
      `ADMIN_PASSWORD com menos de ${MIN_PASSWORD_LENGTH} caracteres`,
    );
  } else if (isCommonPassword(password)) {
    errors.push('ADMIN_PASSWORD está na lista de senhas comuns');
  }

  if (errors.length > 0) {
    throw new Error(`Administrador inicial não criado: ${errors.join('; ')}.`);
  }

  return { email, cpf: onlyDigits(cpf), password };
}
