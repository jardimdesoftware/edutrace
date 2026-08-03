/**
 * Users Endpoint Tests — EduTrace k6
 *
 * Endpoints testados:
 *   POST   /users          (requer ADMIN)
 *   GET    /users
 *   GET    /users/:email
 *   PATCH  /users/:email
 *   DELETE /users/:id
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { getToken, authHeaders } from '../../helpers/auth.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@edutrace.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'senhaSegura123';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

// Token obtido uma única vez antes dos testes (no setup)
export function setup() {
  const token = getToken(BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
  return { token };
}

export default function (data) {
  const headers = authHeaders(data.token);

  // Email único por iteração para evitar conflitos
  const testEmail = `k6.user.${Date.now()}.${Math.floor(Math.random() * 10000)}@test.com`;

  // ─── 1. GET /users — listar todos ────────────────────────────────────────
  const listRes = http.get(`${BASE_URL}/users`, { headers });
  check(listRes, {
    '[users] GET /users retorna 200': (r) => r.status === 200,
    '[users] GET /users retorna array': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body));
      } catch {
        return false;
      }
    },
  });

  // ─── 2. POST /users — criar novo usuário (requer admin) ──────────────────
  const createPayload = JSON.stringify({
    full_name: 'Usuário k6 Teste',
    cpf: `${Math.floor(10000000000 + Math.random() * 89999999999)}`,
    email: testEmail,
    password: 'senhaSegura123',
    id_level: 2,
  });

  const createRes = http.post(`${BASE_URL}/users`, createPayload, { headers });
  check(createRes, {
    '[users] POST /users retorna 201': (r) => r.status === 201,
  });

  // ─── 3. GET /users/:email — buscar por email ─────────────────────────────
  const getOneRes = http.get(`${BASE_URL}/users/${testEmail}`, { headers });
  check(getOneRes, {
    '[users] GET /users/:email retorna 200': (r) => r.status === 200,
    '[users] GET /users/:email retorna email correto': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.email === testEmail;
      } catch {
        return false;
      }
    },
  });

  // ─── 4. PATCH /users/:email — atualizar nome ─────────────────────────────
  const updatePayload = JSON.stringify({ full_name: 'Nome Atualizado k6' });
  const updateRes = http.patch(`${BASE_URL}/users/${testEmail}`, updatePayload, { headers });
  check(updateRes, {
    '[users] PATCH /users/:email retorna 200': (r) => r.status === 200,
  });

  // ─── 5. Buscar ID do usuário para DELETE ─────────────────────────────────
  let userId = null;
  const userRes = http.get(`${BASE_URL}/users/${testEmail}`, { headers });
  if (userRes.status === 200) {
    try {
      userId = JSON.parse(userRes.body).id;
    } catch {}
  }

  // ─── 6. DELETE /users/:id ────────────────────────────────────────────────
  if (userId) {
    const deleteRes = http.del(`${BASE_URL}/users/${userId}`, null, { headers });
    check(deleteRes, {
      '[users] DELETE /users/:id retorna 200': (r) => r.status === 200,
    });
  }

  sleep(1);
}
