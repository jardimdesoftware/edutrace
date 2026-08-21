import { ScreeningData } from "@/interfaces/ScreeningData";
import { apiRequest } from "@/services/http";

export async function getScreeningByEmail(email: string) {
  return apiRequest(`/screenings/${email}`);
}

export async function getAllScreenings() {
  return apiRequest('/screenings');
}

export async function postScreening(screeningData: ScreeningData): Promise<ScreeningData> {
  return apiRequest('/screenings', {
    method: 'POST',
    body: screeningData,
  });
}

export async function deleteScreening(email: string) {
  return apiRequest(`/screenings/${email}`, { method: 'DELETE' });
}

export async function patchScreening(screeningData: ScreeningData, email: string): Promise<ScreeningData> {
  return apiRequest(`/screenings/${email}`, {
    method: 'PATCH',
    body: screeningData,
  });
}
