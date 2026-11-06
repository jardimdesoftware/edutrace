import { apiRequest } from "@/services/http";
import type { ReportGenerator } from "@/interfaces/ReportsData";

export async function getReportByEmail(email: string) {
  return apiRequest(`/reports/${encodeURIComponent(email)}`);
}

export async function getReportGenerator(): Promise<ReportGenerator> {
  return apiRequest("/reports/generator");
}
