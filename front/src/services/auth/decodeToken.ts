import { jwtDecode } from "jwt-decode";
import { clearSession, getToken } from "./session";

export type TokenPayload = {
  sub: number;
  email: string;
  name: string;
  id_level: number;
  must_change_password?: boolean;
  iat: number;
  exp: number;
};

export function decodeToken(): TokenPayload | null {
  if (typeof window === "undefined") return null;

  const token = getToken();
  if (!token) return null;

  try {
    const payload = jwtDecode<TokenPayload>(token);

    const currentTime = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < currentTime) {
      clearSession();
      return null;
    }

    return payload;
  } catch (err) {
    console.error("Token inválido:", err);
    clearSession();
    return null;
  }
}
