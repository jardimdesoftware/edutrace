import type { RegisterData } from "../interfaces/RegisterData";
import { ESTUDANTE } from "../consts";
import { erroDosPapeis, temPapel } from "./papeis";

// Mesmos limites do CreateUserDto do back (student-fields.ts).
export const MATRICULA_MAX_LENGTH = 30;
export const CURSO_MAX_LENGTH = 150;

// Valor do atributo pattern do campo de matrícula, aplicado ao texto digitado:
// aceita minúsculas e espaços nas pontas, que o envio apara e passa para caixa
// alta. O navegador compila o pattern com a flag v, em que o hífen e a barra
// dentro de uma classe de caracteres precisam de escape; sem ele a expressão é
// inválida e a validação é ignorada.
export const MATRICULA_PATTERN = String.raw` *[A-Za-z0-9.\/\-]+ *`;

// Mesmo formato do ENROLLMENT_NUMBER_PATTERN do back, conferido sobre a
// matrícula já aparada e em caixa alta, como o back a normaliza.
const MATRICULA_NORMALIZADA = /^[A-Z0-9./-]+$/;

export type RegisterFormData = {
  nome: string;
  email: string;
  cpf: string;
  roles: number[];
  matricula: string;
  curso: string;
};

export type RegisterFormResult =
  | { ok: true; data: RegisterData }
  | { ok: false; error: string };

// Matrícula e curso só existem para o papel Estudante/Família.
export function cadastraEstudante(roles: readonly number[]): boolean {
  return temPapel(roles, ESTUDANTE);
}

export function erroDaMatricula(matricula: string): string | null {
  if (!matricula) {
    return "Informe a matrícula do estudante.";
  }

  if (matricula.length > MATRICULA_MAX_LENGTH) {
    return `A matrícula deve ter no máximo ${MATRICULA_MAX_LENGTH} caracteres.`;
  }

  if (!MATRICULA_NORMALIZADA.test(matricula.toUpperCase())) {
    return "A matrícula aceita só letras sem acento, números, ponto, hífen e barra.";
  }

  return null;
}

export function buildRegisterData(
  form: RegisterFormData,
  aceitouTermos: boolean,
): RegisterFormResult {
  if (!aceitouTermos) {
    return { ok: false, error: "É necessário aceitar o Termo de Consentimento." };
  }

  const erroPapeis = erroDosPapeis(form.roles);

  if (erroPapeis) {
    return { ok: false, error: erroPapeis };
  }

  const cpf = form.cpf.replace(/\D/g, "");

  if (cpf.length !== 11) {
    return { ok: false, error: "O CPF deve ter 11 dígitos." };
  }

  const matricula = form.matricula.trim();
  const curso = form.curso.trim();
  const estudante = cadastraEstudante(form.roles);

  const erroMatricula = estudante ? erroDaMatricula(matricula) : null;

  if (erroMatricula) {
    return { ok: false, error: erroMatricula };
  }

  if (estudante && !curso) {
    return { ok: false, error: "Informe o curso do estudante." };
  }

  return {
    ok: true,
    data: {
      full_name: form.nome.trim(),
      email: form.email.trim().toLowerCase(),
      cpf,
      roles: [...form.roles].sort((a, b) => a - b),
      ...(estudante ? { enrollment_number: matricula, course: curso } : {}),
    },
  };
}
