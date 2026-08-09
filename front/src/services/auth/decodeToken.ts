import { jwtDecode } from "jwt-decode";

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

  const localToken = localStorage.getItem("token");
  const cookieToken = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("token="))
    ?.split("=")[1];

  const token = localToken || cookieToken;
  if (!token) return null;

  try {
    return jwtDecode<TokenPayload>(token);
  } catch (err) {
    console.error("Token inválido:", err);
    return null;
  }
}