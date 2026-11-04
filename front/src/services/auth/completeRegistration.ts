import { apiRequest } from "@/services/http";
import type { CompleteRegistrationData } from "@/utils/completeRegistrationForm";

export async function completeRegistration(dados: CompleteRegistrationData) {
  return apiRequest("/auth/complete-registration", {
    method: "POST",
    body: dados,
  });
}
