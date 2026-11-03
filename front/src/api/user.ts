import type { StudentData } from "@/interfaces/StudentData";
import { apiRequest } from "@/services/http";

export async function getAllUsers() {
  return apiRequest('/users');
}

export async function updateUser(email: string, roles: number[]): Promise<StudentData> {
  return apiRequest(`/users/${encodeURIComponent(email)}`, {
    method: 'PATCH',
    body: { roles },
  });
}

export type RespostaDaExclusao = {
  user: StudentData;
  reauth_until: string | null;
};

// Marca o usuário para exclusão; o back o apaga de vez depois da carência. O
// 401 desta rota significa senha ausente ou incorreta, não sessão expirada.
export async function deleteUser(
  id: number,
  body: { currentPassword?: string; remember?: boolean },
): Promise<RespostaDaExclusao> {
  return apiRequest(`/users/${id}`, {
    method: 'DELETE',
    body,
    endSessionOnUnauthorized: false,
    errorMessage: 'Erro ao excluir o usuário',
  });
}

export async function restoreUser(id: number): Promise<StudentData> {
  return apiRequest(`/users/${id}/restore`, {
    method: 'POST',
    errorMessage: 'Erro ao restaurar o usuário',
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
