import http from 'k6/http';
import { check } from 'k6';

/**
 * Helper de autenticação para os testes k6 do EduTrace.
 *
 * Realiza login na API e retorna o token JWT + os headers prontos
 * para serem usados em requisições protegidas.
 *
 * @param {string} baseUrl - URL base da API (ex: http://localhost:3000)
 * @param {string} email   - Email do usuário
 * @param {string} password - Senha do usuário
 * @returns {{ token: string, headers: Object } | null}
 */
export function login(baseUrl, email, password) {
  const url = `${baseUrl}/auth/login`;

  const payload = JSON.stringify({ email, password });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(url, payload, params);

  const ok = check(res, {
    '[auth] login retornou 200': (r) => r.status === 200,
    '[auth] token presente na resposta': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.access_token !== undefined;
      } catch(e) {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[auth] Falha no login para ${email}. Status: ${res.status}. Body: ${res.body}`);
    return null;
  }

  const body = JSON.parse(res.body);
  const token = body.access_token;

  return {
    token,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };
}

/**
 * Cria os headers de autenticação a partir de um token já obtido.
 *
 * @param {string} token - JWT token
 * @returns {Object} headers prontos para uso no k6
 */
export function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Realiza login e retorna apenas o token JWT.
 * Aborta o teste se o login falhar.
 *
 * @param {string} baseUrl
 * @param {string} email
 * @param {string} password
 * @returns {string} JWT token
 */
export function getToken(baseUrl, email, password) {
  const auth = login(baseUrl, email, password);
  if (!auth) {
    throw new Error(`[auth] Não foi possível obter token para ${email}. Verifique as credenciais e se a API está rodando.`);
  }
  return auth.token;
}
