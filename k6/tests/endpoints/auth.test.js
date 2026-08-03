/**
 * Auth Endpoint Tests — EduTrace k6
 *
 * Endpoints testados:
 *   POST /auth/login
 *   POST /auth/forgot-password
 *   POST /auth/verify-reset-code
 *   POST /auth/reset-password
 *   GET  /auth/profile
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { login } from '../../helpers/auth.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@edutrace.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'senhaSegura123';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

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
    JSON.stringify({ email: ADMIN_EMAIL, password: 'senhaErrada' }),
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
