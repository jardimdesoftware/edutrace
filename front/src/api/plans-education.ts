import { PlansEducationData } from "@/interfaces/PlansEducationData";
import { apiRequest } from "@/services/http";

export async function getPEIByEmail(email: string) {
  return apiRequest(`/plans-education/${email}`);
}

export async function getAllPEIs() {
  return apiRequest('/plans-education');
}

export async function postPEI(plansEducationData: PlansEducationData): Promise<PlansEducationData> {
  return apiRequest('/plans-education', {
    method: 'POST',
    body: plansEducationData,
  });
}

export async function deletePEI(email: string) {
  return apiRequest(`/plans-education/${email}`, { method: 'DELETE' });
}

export async function patchPEI(plansEducationData: PlansEducationData, email: string): Promise<PlansEducationData> {
  return apiRequest(`/plans-education/${email}`, {
    method: 'PATCH',
    body: plansEducationData,
  });
}
