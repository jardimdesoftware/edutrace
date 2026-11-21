import type { RegisterData } from "@/interfaces/RegisterData";
import { apiRequest } from "@/services/http";
import { ADMIN } from "@/consts";
import { temPapel, type Papeis } from "@/utils/papeis";

export async function login(email: string, password: string) {
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
    errorMessage: 'Erro ao fazer login',
  });

  return data;
}

export async function loginWithGoogle(credential: string) {
  const data = await apiRequest('/auth/google', {
    method: 'POST',
    body: { credential },
    auth: false,
    errorMessage: 'Erro ao fazer login com Google',
  });

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

export async function createStudentByNapne(registerData: RegisterData) {
  return apiRequest('/users/students', {
    method: 'POST',
    body: registerData,
  });
}

// O administrador cadastra por POST /users e o NAPNE, só de estudante, por
// POST /users/students. Conta com os dois papéis cadastra como administrador.
export async function registerUser(
  registerData: RegisterData,
  requesterRoles: Papeis,
) {
  return temPapel(requesterRoles, ADMIN)
    ? createUserByAdmin(registerData)
    : createStudentByNapne(registerData);
}
