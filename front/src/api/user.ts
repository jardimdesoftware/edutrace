import { apiRequest } from "@/services/http";

export async function getAllUsers() {
  return apiRequest('/users');
}

// vai dar certo 2
export async function updateUser(email: string, id_level: string) {
  return apiRequest(`/users/${encodeURIComponent(email)}`, {
    method: 'PATCH',
    body: { id_level: Number(id_level) },
  });
}

// Alteração self-service dos próprios dados (e-mail e/ou senha).
// Ao ter sucesso, o backend troca o cookie de sessão pelo token emitido com os
// dados atualizados.
export async function updateProfile(payload: {
  email?: string;
  password?: string;
  currentPassword: string;
}) {
  // O 401 desta rota significa senha atual incorreta, não sessão expirada.
  return apiRequest('/auth/me', {
    method: 'PATCH',
    body: payload,
    endSessionOnUnauthorized: false,
    errorMessage: 'Erro ao atualizar os dados',
  });
}
