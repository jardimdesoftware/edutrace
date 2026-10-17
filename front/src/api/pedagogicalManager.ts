import type {
  PedagogicalManagerOption,
  PedagogicalManagerPayload,
} from "@/interfaces/PedagogicalManager";
import type { StudentData } from "@/interfaces/StudentData";
import { apiRequest } from "@/services/http";

export async function getPedagogicalManagerOptions(): Promise<PedagogicalManagerOption[]> {
  return apiRequest('/students/pedagogical-manager-options');
}

export async function updatePedagogicalManager(
  email: string,
  payload: PedagogicalManagerPayload,
): Promise<StudentData> {
  return apiRequest(`/students/${encodeURIComponent(email)}/pedagogical-manager`, {
    method: 'PATCH',
    body: payload,
  });
}
