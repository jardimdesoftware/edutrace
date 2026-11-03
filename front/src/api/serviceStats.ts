import type { ServiceStats } from "@/interfaces/ServiceStats";
import { apiRequest } from "@/services/http";

export async function getServiceStats(): Promise<ServiceStats> {
  return apiRequest('/students/service-stats');
}
