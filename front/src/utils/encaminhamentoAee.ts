import { PROFESSOR_AEE, PROFISSIONAL_NAPNE } from "@/consts";
import type { ProfessionalLoad } from "@/interfaces/ServiceStats";
import { temPapel, type Papeis } from "./papeis";

export type TipoDoAviso = "ASSIGNED" | "REMOVED";

// Aviso que o back guarda para o Professor do AEE: recebeu um estudante ou o
// perdeu para outro professor.
export interface AvisoDoEncaminhamento {
  id: number;
  kind: TipoDoAviso;
  student_name: string;
  from_name: string;
  created_at: string;
}

// Quem encaminha é o NAPNE. A regra de verdade é do back (POST /aee-referrals é
// só dele); aqui só decide se a opção aparece.
export function podeEncaminhar(roles: Papeis): boolean {
  return temPapel(roles, PROFISSIONAL_NAPNE);
}

// Só o Professor do AEE recebe os avisos.
export function recebeAvisosDeEncaminhamento(roles: Papeis): boolean {
  return temPapel(roles, PROFESSOR_AEE);
}

export function textoDoAviso(aviso: Pick<AvisoDoEncaminhamento, "kind" | "student_name" | "from_name">): string {
  if (aviso.kind === "REMOVED") {
    return `O aluno ${aviso.student_name} foi encaminhado a outro professor por ${aviso.from_name} e saiu da sua lista.`;
  }

  return `${aviso.from_name}, do NAPNE, encaminhou o aluno ${aviso.student_name} para você.`;
}

export function tituloDosAvisos(quantidade: number): string {
  return quantidade === 1
    ? "Novo aviso de encaminhamento"
    : `${quantidade} novos avisos de encaminhamento`;
}

// "3 de 15 em atendimento, 12 vagas". Sem vaga, o professor aparece bloqueado.
export function textoDaDisponibilidade(professor: Pick<ProfessionalLoad, "in_service" | "capacity" | "free">): string {
  const atendimento = `${professor.in_service} de ${professor.capacity} em atendimento`;

  if (professor.free <= 0) return `${atendimento}, sem vaga`;

  return `${atendimento}, ${professor.free} ${professor.free === 1 ? "vaga" : "vagas"}`;
}

export function podeEscolherProfessor(professor: Pick<ProfessionalLoad, "free">): boolean {
  return professor.free > 0;
}

export function textoDaConfirmacaoDoEncaminhamento(aluno: string | null, professor: string): string {
  return `Encaminhar ${aluno?.trim() || "o estudante"} para ${professor}? O estudante passa a ser atendido agora por este professor, que recebe um aviso.`;
}
