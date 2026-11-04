import { ehCurso } from "./cursos";
import { erroDaMatricula } from "./registerForm";

export type CompleteRegistrationFormData = {
  cpf: string;
  matricula: string;
  curso: string;
  senha: string;
  confirmarSenha: string;
};

export type CompleteRegistrationData = {
  cpf: string;
  password: string;
  enrollment_number: string;
  course: string;
};

export type CompleteRegistrationResult =
  | { ok: true; data: CompleteRegistrationData }
  | { ok: false; error: string };

export function buildCompleteRegistration(
  form: CompleteRegistrationFormData,
): CompleteRegistrationResult {
  const cpf = form.cpf.replace(/\D/g, "");

  if (cpf.length !== 11) {
    return { ok: false, error: "O CPF deve ter 11 dígitos." };
  }

  const matricula = form.matricula.trim();
  const erroMatricula = erroDaMatricula(matricula);

  if (erroMatricula) {
    return { ok: false, error: erroMatricula };
  }

  if (!ehCurso(form.curso)) {
    return { ok: false, error: "Selecione o seu curso na lista." };
  }

  if (form.senha.length < 8) {
    return { ok: false, error: "A senha deve ter no mínimo 8 caracteres." };
  }

  if (form.senha !== form.confirmarSenha) {
    return { ok: false, error: "As senhas não coincidem." };
  }

  return {
    ok: true,
    data: {
      cpf,
      password: form.senha,
      enrollment_number: matricula.toUpperCase(),
      course: form.curso,
    },
  };
}
