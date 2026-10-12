import type { PlansEducationData } from "@/interfaces/PlansEducationData";
import type { PlansEducationPayload } from "@/utils/peiPayload";
import { apiRequest } from "@/services/http";

export async function getPEIByEmail(email: string) {
  return apiRequest(`/plans-education/${encodeURIComponent(email)}`);
}

export async function getAllPEIs() {
  return apiRequest('/plans-education');
}

export async function postPEI(plansEducationData: PlansEducationPayload): Promise<PlansEducationData> {
  return apiRequest('/plans-education', {
    method: 'POST',
    body: plansEducationData,
  });
}

export async function deletePEI(email: string) {
  return apiRequest(`/plans-education/${encodeURIComponent(email)}`, { method: 'DELETE' });
}

export async function patchPEI(plansEducationData: Partial<PlansEducationData>, email: string): Promise<PlansEducationData> {
  return apiRequest(`/plans-education/${encodeURIComponent(email)}`, {
    method: 'PATCH',
    body: plansEducationData,
  });
}
