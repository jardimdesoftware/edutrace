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
  return readSeedAccount(env, 'ADMIN', 'Administrador inicial');
}

// Conta de Profissional NAPNE que o seed cria só quando NAPNE_PASSWORD existe,
// para os testes de carga do k6, que precisam de uma conta com acesso às rotas
// clínicas. Mesmas regras de e-mail, CPF e senha do administrador.
export function readSeedNapne(
  env: Record<string, string | undefined>,
): InitialAdmin {
  return readSeedAccount(env, 'NAPNE', 'Profissional NAPNE de teste');
}

function readSeedAccount(
  env: Record<string, string | undefined>,
  prefix: string,
  label: string,
): InitialAdmin {
  const email = env[`${prefix}_EMAIL`]?.trim() ?? '';
  const cpf = env[`${prefix}_CPF`] ?? '';
  const password = env[`${prefix}_PASSWORD`] ?? '';
  const errors: string[] = [];

  if (!isEmail(email)) {
    errors.push(`${prefix}_EMAIL ausente ou fora do formato de e-mail`);
  }
  if (!isValidCpf(cpf)) {
    errors.push(`${prefix}_CPF ausente ou inválido`);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(
      `${prefix}_PASSWORD com menos de ${MIN_PASSWORD_LENGTH} caracteres`,
    );
  } else if (isCommonPassword(password)) {
    errors.push(`${prefix}_PASSWORD está na lista de senhas comuns`);
  }

  if (errors.length > 0) {
    throw new Error(`${label} não criado: ${errors.join('; ')}.`);
  }

  return { email, cpf: onlyDigits(cpf), password };
}
