import { RegisterData } from "@/interfaces/RegisterData";
import { apiRequest } from "@/services/http";
import { setTokenCookie } from "./tokenCookie";

export async function login(email: string, password: string) {
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
    errorMessage: 'Erro ao fazer login',
  });

  localStorage.setItem('token', data.access_token);

  setTokenCookie(data.access_token);

  return data;
}

export async function createUserByAdmin(registerData: RegisterData) {
  return apiRequest('/users', {
    method: 'POST',
    body: registerData,
  });
}
