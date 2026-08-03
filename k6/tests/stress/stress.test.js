/**
 * Stress Test — EduTrace k6
 *
 * Objetivo: Encontrar o limite de capacidade da API aumentando
 * progressivamente a carga até o sistema degradar.
 *
 * Estágios (escala exponencial):
 *   - 10 VUs  → 30s
 *   - 20 VUs  → 1min
 *   - 40 VUs  → 30s
 *   - 40 VUs  → 1min
 *   - 80 VUs  → 30s
 *   - 80 VUs  → 1min
 *   - 0 VUs   → 30s (ramp-down)
 *   Total: ~5 minutos
 *
 * Thresholds são mais permissivos para identificar onde ocorre a degradação.
 *
 * Executar com:
 *   k6 run k6/tests/stress/stress.test.js
 *   k6 run --out json=stress-results.json k6/tests/stress/stress.test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { getToken, authHeaders } from '../../helpers/auth.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@edutrace.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'senhaSegura123';

export const options = {
  stages: [
    { duration: '30s', target: 10  }, // aquecimento
    { duration: '1m',  target: 20  }, // carga leve
    { duration: '30s', target: 40  }, // carga média
    { duration: '1m',  target: 40  }, // sustenta carga média
    { duration: '30s', target: 80  }, // carga pesada
    { duration: '1m',  target: 80  }, // sustenta carga pesada
    { duration: '30s', target: 0   }, // ramp-down
  ],
  thresholds: {
    // Mais permissivo — queremos ver onde a API começa a falhar
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

export function setup() {
  const token = getToken(BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
  return { token };
}

export default function (data) {
  const headers = authHeaders(data.token);

  // ─── Endpoints de leitura (maior impacto sob stress) ──────────────────────
  group('Stress - Screenings List', () => {
    const res = http.get(`${BASE_URL}/screenings`, { headers });
    check(res, {
      '[stress][screenings] status 200': (r) => r.status === 200,
      '[stress][screenings] < 1000ms': (r) => r.timings.duration < 1000,
    });
  });

  sleep(0.2);

  group('Stress - Anamnesis List', () => {
    const res = http.get(`${BASE_URL}/anamnesis`, { headers });
    check(res, {
      '[stress][anamnesis] status 200': (r) => r.status === 200,
      '[stress][anamnesis] < 1000ms': (r) => r.timings.duration < 1000,
    });
  });

  sleep(0.2);

  group('Stress - Plans Education List', () => {
    const res = http.get(`${BASE_URL}/plans-education`, { headers });
    check(res, {
      '[stress][plans-education] status 200': (r) => r.status === 200,
      '[stress][plans-education] < 1000ms': (r) => r.timings.duration < 1000,
    });
  });

  sleep(0.2);

  group('Stress - Users List', () => {
    const res = http.get(`${BASE_URL}/users`, { headers });
    check(res, {
      '[stress][users] status 200': (r) => r.status === 200,
      '[stress][users] < 1000ms': (r) => r.timings.duration < 1000,
    });
  });

  sleep(0.2);

  group('Stress - Auth Profile', () => {
    const res = http.get(`${BASE_URL}/auth/profile`, { headers });
    check(res, {
      '[stress][auth/profile] status 200': (r) => r.status === 200,
      '[stress][auth/profile] < 500ms': (r) => r.timings.duration < 500,
    });
  });

  sleep(0.5);
}

export function teardown() {
  console.log('✅ Stress test concluído. Analise os resultados para identificar o ponto de saturação.');
}
