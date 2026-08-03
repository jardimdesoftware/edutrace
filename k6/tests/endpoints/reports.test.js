/**
 * Reports Endpoint Tests — EduTrace k6
 *
 * Endpoints testados:
 *   GET /reports/:email
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { getToken, authHeaders } from '../../helpers/auth.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@edutrace.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'senhaSegura123';

// Email de um estudante que já possui dados completos no banco
// Configure via variável de ambiente: k6 run -e TEST_STUDENT_EMAIL=...
const TEST_STUDENT_EMAIL = __ENV.TEST_STUDENT_EMAIL || 'estudante@edutrace.com';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export function setup() {
  const token = getToken(BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
  return { token };
}

export default function (data) {
  const headers = authHeaders(data.token);

  // ─── GET /reports/:email ──────────────────────────────────────────────────
  const res = http.get(`${BASE_URL}/reports/${TEST_STUDENT_EMAIL}`, { headers });

  check(res, {
    '[reports] GET /reports/:email retorna 200': (r) => r.status === 200,
    '[reports] GET /reports/:email retorna conteúdo': (r) => r.body.length > 0,
    '[reports] tempo de resposta < 500ms': (r) => r.timings.duration < 500,
  });

  // ─── GET com email inválido (deve retornar 404 ou null) ───────────────────
  const invalidRes = http.get(`${BASE_URL}/reports/email-inexistente@test.com`, { headers });
  check(invalidRes, {
    '[reports] email inválido retorna 200 ou 404': (r) => [200, 404].includes(r.status),
  });

  sleep(1);
}
