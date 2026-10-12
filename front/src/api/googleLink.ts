import { apiRequest } from "@/services/http";

export type GoogleLinkStatus = { enabled: boolean; linked: boolean };

// Vínculo da Conta Google usada no "Entrar com o Google" com a conta da sessão.
export async function getGoogleLinkStatus(): Promise<GoogleLinkStatus> {
  return apiRequest('/auth/google/link', {
    errorMessage: 'Erro ao consultar o vínculo com o Google',
  });
}

// O 401 desta rota significa senha atual incorreta ou credencial do Google
// recusada, não sessão expirada.
export async function linkGoogleAccount(payload: {
  credential: string;
  currentPassword: string;
}) {
  return apiRequest('/auth/google/link', {
    method: 'POST',
    body: payload,
    endSessionOnUnauthorized: false,
    errorMessage: 'Erro ao vincular a Conta Google',
  });
}

export async function unlinkGoogleAccount() {
  return apiRequest('/auth/google/link', {
    method: 'DELETE',
    errorMessage: 'Erro ao desvincular a Conta Google',
  });
}
