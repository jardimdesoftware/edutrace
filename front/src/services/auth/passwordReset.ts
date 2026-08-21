import { apiRequest } from "@/services/http";

async function postPasswordReset(path: string, body: Record<string, string>) {
  return apiRequest(path, {
    method: 'POST',
    body,
    auth: false,
  });
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
