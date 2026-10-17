import type { AeePlan, AeePlanPayload } from "@/interfaces/AeePlan";
import { apiRequest } from "@/services/http";

function caminhoDoPlano(id: number) {
  return `/aee-plans/${id}`;
}

// Do período mais recente para o mais antigo; vazia quando o estudante não tem
// PAEE.
export async function listAeePlans(email: string): Promise<AeePlan[]> {
  return apiRequest(`/aee-plans/${encodeURIComponent(email)}`);
}

export async function createAeePlan(email: string, semester: string, sections: AeePlanPayload) {
  return apiRequest("/aee-plans", {
    method: "POST",
    body: { student_email: email, semester, ...sections },
  });
}

// O período não muda depois que o PAEE é criado, então o PATCH só leva as seções.
export async function updateAeePlan(id: number, sections: AeePlanPayload) {
  return apiRequest(caminhoDoPlano(id), { method: "PATCH", body: sections });
}

export async function deleteAeePlan(id: number) {
  return apiRequest(caminhoDoPlano(id), { method: "DELETE" });
}
