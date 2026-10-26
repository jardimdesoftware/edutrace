import { apiRequest } from '@/services/http';

export type SessionUser = {
  sub: number;
  email: string;
  name: string;
  roles: number[];
  must_change_password?: boolean;
  must_complete_registration?: boolean;
};

// O front não lê o token. Quem identifica o usuário é o back, a partir do
// cookie HttpOnly; sem sessão válida a rota responde 401 e não há usuário.
export async function fetchSessionUser(): Promise<SessionUser | null> {
  try {
    return (await apiRequest('/auth/profile', {
      endSessionOnUnauthorized: false,
    })) as SessionUser;
  } catch {
    return null;
  }
}
