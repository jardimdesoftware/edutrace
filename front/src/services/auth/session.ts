import { clearTokenCookie, getTokenCookie } from './tokenCookie';

const TOKEN_STORAGE_KEY = 'token';

export function getToken() {
  if (typeof window === 'undefined') return null;

  return localStorage.getItem(TOKEN_STORAGE_KEY) || getTokenCookie();
}

export function clearSession() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(TOKEN_STORAGE_KEY);
  clearTokenCookie();
}

export function endSession() {
  clearSession();

  if (typeof window !== 'undefined') {
    window.location.replace('/');
  }
}
