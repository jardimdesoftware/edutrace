/**
 * Load Test — EduTrace k6
 *
 * Objetivo: Simular carga normal de produção.
 * Valida o comportamento da API sob uso simultâneo por múltiplos usuários.
 *
 * Estágios:
 *   - Ramp-up:    30s → 10 VUs
 *   - Sustentado: 1min @ 10 VUs
 *   - Pico:       30s → 20 VUs
 *   - Sustentado: 1min @ 20 VUs
 *   - Ramp-down:  30s → 0 VUs
 *   Total: ~3.5 minutos
 *
 * Executar com:
 *   k6 run k6/tests/load/load.test.js
 *   k6 run --out json=results.json k6/tests/load/load.test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { getToken, authHeaders } from '../../helpers/auth.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@edutrace.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'senhaSegura123';

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // ramp-up
    { duration: '1m',  target: 10 }, // carga normal
    { duration: '30s', target: 20 }, // pico moderado
    { duration: '1m',  target: 20 }, // sustenta pico
    { duration: '30s', target: 0  }, // ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.95'],
  },
};

export function setup() {
  const token = getToken(BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
  return { token };
}

export default function (data) {
  const headers = authHeaders(data.token);

  // ─── Fluxo 1: Leitura de dados (mais comum) ───────────────────────────────
  group('Leitura - Screenings', () => {
    const res = http.get(`${BASE_URL}/screenings`, { headers });
    check(res, {
      '[load][screenings] GET → 200': (r) => r.status === 200,
      '[load][screenings] < 500ms': (r) => r.timings.duration < 500,
    });
  });

  sleep(0.3);

  group('Leitura - Anamnesis', () => {
    const res = http.get(`${BASE_URL}/anamnesis`, { headers });
    check(res, {
      '[load][anamnesis] GET → 200': (r) => r.status === 200,
      '[load][anamnesis] < 500ms': (r) => r.timings.duration < 500,
    });
  });

  sleep(0.3);

  group('Leitura - Plans Education', () => {
    const res = http.get(`${BASE_URL}/plans-education`, { headers });
    check(res, {
      '[load][plans-education] GET → 200': (r) => r.status === 200,
      '[load][plans-education] < 500ms': (r) => r.timings.duration < 500,
    });
  });

  sleep(0.3);

  group('Leitura - Users', () => {
    const res = http.get(`${BASE_URL}/users`, { headers });
    check(res, {
      '[load][users] GET → 200': (r) => r.status === 200,
      '[load][users] < 500ms': (r) => r.timings.duration < 500,
    });
  });

  sleep(0.3);

  group('Leitura - Students', () => {
    const res = http.get(`${BASE_URL}/students`, { headers });
    check(res, {
      '[load][students] GET → 200': (r) => r.status === 200,
      '[load][students] < 300ms': (r) => r.timings.duration < 300,
    });
  });

  sleep(0.3);

  // ─── Fluxo 2: Auth check periódico ────────────────────────────────────────
  group('Auth - Profile', () => {
    const res = http.get(`${BASE_URL}/auth/profile`, { headers });
    check(res, {
      '[load][auth/profile] GET → 200': (r) => r.status === 200,
      '[load][auth/profile] < 200ms': (r) => r.timings.duration < 200,
    });
  });

  sleep(1);
}

export function teardown() {
  console.log('✅ Load test concluído.');
}
