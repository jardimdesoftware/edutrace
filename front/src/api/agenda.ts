import { apiRequest } from "@/services/http";
import type { Atendimento, EstudanteDaAgenda } from "@/utils/agenda";

export interface DadosDoAtendimento {
  id_student: number;
  starts_at: string;
  ends_at: string;
  notes?: string;
}

export async function listarAtendimentos(from: string, to: string): Promise<Atendimento[]> {
  const periodo = new URLSearchParams({ from, to });
  return apiRequest(`/aee-appointments?${periodo.toString()}`);
}

// Os estudantes que o professor atende, os únicos que a agenda aceita.
export async function listarEstudantesDaAgenda(): Promise<EstudanteDaAgenda[]> {
  return apiRequest("/aee-appointments/students");
}

export async function criarAtendimento(dados: DadosDoAtendimento): Promise<Atendimento> {
  return apiRequest("/aee-appointments", { method: "POST", body: dados });
}

export async function alterarAtendimento(id: number, dados: Partial<DadosDoAtendimento>): Promise<Atendimento> {
  return apiRequest(`/aee-appointments/${id}`, { method: "PATCH", body: dados });
}

export async function removerAtendimento(id: number): Promise<void> {
  await apiRequest(`/aee-appointments/${id}`, { method: "DELETE" });
}
