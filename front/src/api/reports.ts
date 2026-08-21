import { apiRequest } from "@/services/http";

export async function getReportByEmail(email: string) {
  return apiRequest(`/reports/${email}`);
}
