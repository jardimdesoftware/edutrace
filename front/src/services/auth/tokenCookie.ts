const TOKEN_COOKIE_NAME = 'token';

function securityAttributes() {
  const isHttps =
    typeof location !== 'undefined' && location.protocol === 'https:';

  return `path=/; SameSite=Lax${isHttps ? '; Secure' : ''}`;
}

export function setTokenCookie(token: string) {
  document.cookie = `${TOKEN_COOKIE_NAME}=${token}; ${securityAttributes()}`;
}

export function clearCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${securityAttributes()}`;
}
