import type { AvisoDoEncaminhamento } from "@/utils/encaminhamentoAee";
import { apiRequest } from "@/services/http";

// A lista de professores com a disponibilidade vem de getServiceStats.
export async function encaminharEstudante(email: string, teacherId: number) {
  return apiRequest("/aee-referrals", {
    method: "POST",
    body: { student_email: email, teacher_id: teacherId },
  });
}

export async function listarAvisosDoEncaminhamento(): Promise<AvisoDoEncaminhamento[]> {
  return apiRequest("/aee-referrals/notifications");
}

export async function marcarAvisosComoVistos(ids: number[]): Promise<{ marked: number }> {
  return apiRequest("/aee-referrals/notifications/seen", {
    method: "POST",
    body: { ids },
  });
}
