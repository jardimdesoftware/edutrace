import { apiRequest } from "@/services/http";
import { setTokenCookie } from "@/services/auth/tokenCookie";

export async function getUserByEmail(email: string) {
  return apiRequest(`/users/${email}`);
}

// vai dar certo 2
export async function updateUser(email: string, id_level: string) {
  return apiRequest(`/users/${email}`, {
    method: 'PATCH',
    body: { id_level: Number(id_level) },
  });
}

// Alteração self-service dos próprios dados (e-mail e/ou senha).
// Ao ter sucesso, o backend devolve um novo token com o e-mail atualizado;
// persistimos ele em localStorage e cookie para refletir em toda a aplicação.
export async function updateProfile(payload: {
  email?: string;
  password?: string;
  currentPassword: string;
}) {
  // O 401 desta rota significa senha atual incorreta, não sessão expirada.
  const data = await apiRequest('/auth/me', {
    method: 'PATCH',
    body: payload,
    endSessionOnUnauthorized: false,
    errorMessage: 'Erro ao atualizar os dados',
  });

  if (data?.access_token) {
    localStorage.setItem('token', data.access_token);
    setTokenCookie(data.access_token);
  }

  return data;
}
