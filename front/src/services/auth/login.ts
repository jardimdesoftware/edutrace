import { RegisterData } from "@/interfaces/RegisterData";
import { getApiUrl } from "@/utils/runtimeApiUrl";
import { setTokenCookie } from "./tokenCookie";

export async function login(email: string, password: string) {
  const API_URL = getApiUrl();

  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || 'Erro ao fazer login');
  }

  localStorage.setItem('token', data.access_token);

  setTokenCookie(data.access_token);

  return data;
}

export async function createUserByAdmin(registerData: RegisterData) {
  const API_URL = getApiUrl();
  const localToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const cookieToken = typeof window !== 'undefined'
    ? document.cookie
        .split(';')
        .map((item) => item.trim())
        .find((item) => item.startsWith('token='))
        ?.split('=')[1]
    : null;
  const token = localToken || cookieToken;

  const res = await fetch(`${API_URL}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(registerData),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Erro ao processar requisição');
  }
  
  return data;
}