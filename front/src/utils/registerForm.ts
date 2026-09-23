import type { RegisterData } from "../interfaces/RegisterData";

export type RegisterFormData = {
  nome: string;
  email: string;
  cpf: string;
  senha: string;
  confirmarSenha: string;
  id_level: string;
};

export type RegisterFormResult =
  | { ok: true; data: RegisterData }
  | { ok: false; error: string };

export function buildRegisterData(
  form: RegisterFormData,
  aceitouTermos: boolean,
): RegisterFormResult {
  if (!aceitouTermos) {
    return { ok: false, error: "É necessário aceitar o Termo de Consentimento." };
  }

  if (form.senha !== form.confirmarSenha) {
    return { ok: false, error: "As senhas não coincidem." };
  }

  const cpf = form.cpf.replace(/\D/g, "");

  if (cpf.length !== 11) {
    return { ok: false, error: "O CPF deve ter 11 dígitos." };
  }

  return {
    ok: true,
    data: {
      full_name: form.nome.trim(),
      email: form.email.trim().toLowerCase(),
      cpf,
      password: form.senha,
      id_level: Number(form.id_level),
    },
  };
}
