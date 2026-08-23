/**
 * Auth Endpoint Tests — EduTrace k6
 *
 * Endpoints testados:
 *   POST /auth/login
 *   POST /auth/forgot-password
 *   GET  /auth/profile
 *
 * Não testados neste script: POST /auth/verify-reset-code e
 * POST /auth/reset-password — dependem de um código de reset gerado
 * por e-mail, sem forma direta de obtê-lo via API.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { login } from '../../helpers/auth.js';
import { endpointOptions } from '../../config/options.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@edutrace.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'senhaSegura123';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// O login falho usa um e-mail que não existe no banco. Repetir a falha na conta
// admin bloquearia o acesso dela na quinta iteração e derrubaria tanto este
// check quanto os passos seguintes, que dependem do token.
const UNKNOWN_EMAIL = __ENV.UNKNOWN_EMAIL || 'conta-inexistente-k6@edutrace.com';

export const options = endpointOptions;

export default function () {
  // ─── 1. Login com credenciais válidas ─────────────────────────────────────
  const auth = login(BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);

  if (!auth) {
    console.error('Falha no login — abortando iteração.');
    sleep(1);
    return;
  }

  // ─── 2. Login com credenciais inválidas (deve retornar 401) ───────────────
  const invalidLoginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: UNKNOWN_EMAIL, password: 'senhaErrada' }),
    { headers: JSON_HEADERS },
  );
  check(invalidLoginRes, {
    '[auth] login inválido retorna 401': (r) => r.status === 401,
  });

  // ─── 3. Buscar perfil com token válido ────────────────────────────────────
  const profileRes = http.get(`${BASE_URL}/auth/profile`, {
    headers: auth.headers,
  });
  check(profileRes, {
    '[auth/profile] retorna 200': (r) => r.status === 200,
    '[auth/profile] contém email': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.email === 'string';
      } catch {
        return false;
      }
    },
  });

  // ─── 4. Buscar perfil sem token (deve retornar 401) ───────────────────────
  const profileNoTokenRes = http.get(`${BASE_URL}/auth/profile`, {
    headers: JSON_HEADERS,
  });
  check(profileNoTokenRes, {
    '[auth/profile] sem token retorna 401': (r) => r.status === 401,
  });

  // ─── 5. Forgot password com email válido ──────────────────────────────────
  const forgotRes = http.post(
    `${BASE_URL}/auth/forgot-password`,
    JSON.stringify({ email: ADMIN_EMAIL }),
    { headers: JSON_HEADERS },
  );
  check(forgotRes, {
    '[auth/forgot-password] retorna 200': (r) => r.status === 200,
  });

  sleep(1);
}
