import { AnamnesisData } from "../interfaces/AnamnesisData";
import { apiRequest } from "@/services/http";

export async function getAnamneseByEmail(email: string) {
  return apiRequest(`/anamnesis/${email}`);
}

export async function getAllAnamneses() {
  return apiRequest('/anamnesis');
}

export async function postAnamneses(anamneseData: AnamnesisData): Promise<AnamnesisData> {
  return apiRequest('/anamnesis', {
    method: 'POST',
    body: anamneseData,
  });
}

export async function deleteAnamnesis(email: string) {
  return apiRequest(`/anamnesis/${email}`, { method: 'DELETE' });
}

export async function patchAnamnesis(anamneseData: AnamnesisData, email: string) {
  return apiRequest(`/anamnesis/${email}`, {
    method: 'PATCH',
    body: anamneseData,
  });
}
