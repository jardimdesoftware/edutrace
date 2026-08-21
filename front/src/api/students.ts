import { apiRequest } from "@/services/http";

export async function getAllStudents() {
  return apiRequest('/users');
}
