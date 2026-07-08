import { getApiUrl } from "@/utils/runtimeApiUrl";

async function postPasswordReset(path: string, body: Record<string, string>) {
  const API_URL = getApiUrl();

  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join(' ')
      : data.message;
    throw new Error(message || 'Erro ao processar requisição');
  }

  return data;
}

export async function forgotPassword(email: string) {
  return postPasswordReset('/auth/forgot-password', { email });
}

export async function verifyResetCode(email: string, code: string) {
  return postPasswordReset('/auth/verify-reset-code', { email, code });
}

export async function resetPassword(email: string, code: string, password: string) {
  return postPasswordReset('/auth/reset-password', { email, code, password });
}
