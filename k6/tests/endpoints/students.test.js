/**
 * Students Endpoint Tests — EduTrace k6
 *
 * Endpoints testados:
 *   GET /students
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

export function setup() {
  const token = getToken(BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
  return { token };
}

export default function (data) {
  const headers = authHeaders(data.token);

  // ─── GET /students ────────────────────────────────────────────────────────
  const res = http.get(`${BASE_URL}/students`, { headers });

  check(res, {
    '[students] GET /students retorna 200': (r) => r.status === 200,
    '[students] GET /students retorna array': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body));
      } catch {
        return false;
      }
    },
    '[students] tempo de resposta < 300ms': (r) => r.timings.duration < 300,
  });

  sleep(1);
}
