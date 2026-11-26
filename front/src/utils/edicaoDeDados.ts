import type { StudentData } from "@/interfaces/StudentData";

export interface CamposDaEdicao {
  full_name: string;
  email: string;
  cpf: string;
  enrollment_number: string;
  course: string;
}

export type AlteracoesDaEdicao = Partial<CamposDaEdicao>;

// A lista mostra o CPF mascarado, então o campo começa vazio e só é enviado
// quando o administrador digita um CPF novo.
export function camposIniciais(usuario: StudentData): CamposDaEdicao {
  return {
    full_name: usuario.full_name,
    email: usuario.email,
    cpf: "",
    enrollment_number: usuario.enrollment_number ?? "",
    course: usuario.course ?? "",
  };
}

// Só vai no PATCH o que mudou: um campo igual ao gravado não é reenviado, e
// matrícula e curso só existem para o estudante (o back recusa nos demais).
export function alteracoesDaEdicao(
  usuario: StudentData,
  campos: CamposDaEdicao,
  ehEstudante: boolean,
): AlteracoesDaEdicao {
  const alteracoes: AlteracoesDaEdicao = {};
  const nome = campos.full_name.trim();
  const email = campos.email.trim();
  const cpf = campos.cpf.replace(/\D/g, "");

  if (nome !== usuario.full_name) alteracoes.full_name = nome;
  if (email !== usuario.email) alteracoes.email = email;
  if (cpf !== "") alteracoes.cpf = cpf;

  if (ehEstudante) {
    const matricula = campos.enrollment_number.trim();
    if (matricula !== (usuario.enrollment_number ?? "")) {
      alteracoes.enrollment_number = matricula;
    }
    if (campos.course !== "" && campos.course !== (usuario.course ?? "")) {
      alteracoes.course = campos.course;
    }
  }

  return alteracoes;
}
