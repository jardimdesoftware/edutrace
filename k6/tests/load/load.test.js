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
import { loadOptions } from '../../config/options.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@edutrace.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'senhaSegura123';
const NAPNE_EMAIL = __ENV.NAPNE_EMAIL || 'napne@edutrace.com';
const NAPNE_PASSWORD = __ENV.NAPNE_PASSWORD || 'senhaSegura123';

// Estudante que já existe no banco; o administrador lê o PEI de qualquer um.
// Configure via variável de ambiente: k6 run -e TEST_STUDENT_EMAIL=...
const TEST_STUDENT_EMAIL = __ENV.TEST_STUDENT_EMAIL || 'estudante@edutrace.com';

export const options = loadOptions;

export function setup() {
  const token = getToken(BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
  const napneToken = getToken(BASE_URL, NAPNE_EMAIL, NAPNE_PASSWORD);
  return { token, napneToken };
}

export default function (data) {
  const headers = authHeaders(data.token);
  const napneHeaders = authHeaders(data.napneToken);

  // ─── Fluxo 1: Leitura de dados (mais comum) ───────────────────────────────
  group('Leitura - Screenings', () => {
    const res = http.get(`${BASE_URL}/screenings`, { headers: napneHeaders });
    check(res, {
      '[load][screenings] GET → 200': (r) => r.status === 200,
      '[load][screenings] < 500ms': (r) => r.timings.duration < 500,
    });
  });

  sleep(0.3);

  group('Leitura - Anamnesis', () => {
    const res = http.get(`${BASE_URL}/anamnesis`, { headers: napneHeaders });
    check(res, {
      '[load][anamnesis] GET → 200': (r) => r.status === 200,
      '[load][anamnesis] < 500ms': (r) => r.timings.duration < 500,
    });
  });

  sleep(0.3);

  group('Leitura - PEI', () => {
    const res = http.get(`${BASE_URL}/pei-entries/${TEST_STUDENT_EMAIL}`, { headers: napneHeaders });
    check(res, {
      '[load][pei-entries] GET → 200': (r) => r.status === 200,
      '[load][pei-entries] < 500ms': (r) => r.timings.duration < 500,
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
    const res = http.get(`${BASE_URL}/students`, { headers: napneHeaders });
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
