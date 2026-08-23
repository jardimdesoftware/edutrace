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

export async function logout() {
  // O 401 aqui significa que a sessão já não vale no servidor, e o encerramento
  // local acontece de qualquer forma em quem chama.
  return apiRequest('/auth/logout', {
    method: 'POST',
    endSessionOnUnauthorized: false,
  });
}

export async function createUserByAdmin(registerData: RegisterData) {
  return apiRequest('/users', {
    method: 'POST',
    body: registerData,
  });
}
