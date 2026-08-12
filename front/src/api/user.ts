import { getApiUrl } from "@/utils/runtimeApiUrl";

export async function getUserByEmail(email: string) {
  const API_URL = getApiUrl();

  const res = await fetch(`${API_URL}/users/${email}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new Error(data?.detail || 'Erro ao processar requisição');
  }
  return data;
}

// vai dar certo 2
export async function updateUser(email: string, id_level: string) {
  const API_URL = getApiUrl();

  const res = await fetch(`${API_URL}/users/${email}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      'Content-Type': 'application/json', 
    },
    body: JSON.stringify({
      id_level: Number(id_level)
    }),
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new Error(data?.detail || 'Erro ao processar requisição');
  }
  return data;
}

// Alteração self-service dos próprios dados (e-mail e/ou senha).
// Ao ter sucesso, o backend devolve um novo token com o e-mail atualizado;
// persistimos ele em localStorage e cookie para refletir em toda a aplicação.
export async function updateProfile(payload: {
  email?: string;
  password?: string;
  currentPassword: string;
}) {
  const API_URL = getApiUrl();
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const res = await fetch(`${API_URL}/auth/me`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new Error(data?.message || 'Erro ao atualizar os dados');
  }

  if (data?.access_token) {
    localStorage.setItem('token', data.access_token);
    document.cookie = `token=${data.access_token}; path=/;`;
  }

  return data;
}
