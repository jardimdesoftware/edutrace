/**
 * Smoke Test — EduTrace k6
 *
 * Objetivo: Validação rápida de sanidade da API.
 * Verifica se todos os endpoints principais estão acessíveis e respondendo.
 *
 * Configuração: 1 VU por 30 segundos (carga mínima).
 *
 * Executar com:
 *   k6 run k6/tests/smoke/smoke.test.js
 *   k6 run -e BASE_URL=http://localhost:3000 -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... k6/tests/smoke/smoke.test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { login, authHeaders } from '../../helpers/auth.js';
import { smokeOptions } from '../../config/options.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@edutrace.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'senhaSegura123';

export const options = smokeOptions;

export function setup() {
  // Validar login antes de iniciar
  const auth = login(BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
  if (!auth) {
    throw new Error('Smoke test ABORTADO: falha no login. Verifique as credenciais e se a API está rodando.');
  }
  return { token: auth.token };
}

export default function (data) {
  const headers = authHeaders(data.token);
  const jsonHeaders = { 'Content-Type': 'application/json' };

  // ─── Auth ──────────────────────────────────────────────────────────────────
  group('Auth', () => {
    // Login
    const loginRes = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      { headers: jsonHeaders },
    );
    check(loginRes, {
      '[smoke][auth] POST /auth/login → 200': (r) => r.status === 200,
      '[smoke][auth] token presente': (r) => {
        try { 
          return !!JSON.parse(r.body).access_token; 
        } catch (e) { 
          return false; 
        }
      },
    });

    // Profile
    const profileRes = http.get(`${BASE_URL}/auth/profile`, { headers });
    check(profileRes, {
      '[smoke][auth] GET /auth/profile → 200': (r) => r.status === 200,
    });
  });

  sleep(0.5);

  // ─── Users ────────────────────────────────────────────────────────────────
  group('Users', () => {
    const res = http.get(`${BASE_URL}/users`, { headers });
    check(res, {
      '[smoke][users] GET /users → 200': (r) => r.status === 200,
      '[smoke][users] resposta é array': (r) => {
        try { 
          return Array.isArray(JSON.parse(r.body)); 
        } catch (e) { 
          return false; 
        }
      },
    });
  });

  sleep(0.5);

  // ─── Students ─────────────────────────────────────────────────────────────
  group('Students', () => {
    const res = http.get(`${BASE_URL}/students`, { headers });
    check(res, {
      '[smoke][students] GET /students → 200': (r) => r.status === 200,
    });
  });

  sleep(0.5);

  // ─── Screenings ───────────────────────────────────────────────────────────
  group('Screenings', () => {
    const res = http.get(`${BASE_URL}/screenings`, { headers });
    check(res, {
      '[smoke][screenings] GET /screenings → 200': (r) => r.status === 200,
      '[smoke][screenings] resposta é array': (r) => {
        try { 
          return Array.isArray(JSON.parse(r.body)); 
        } catch (e) { 
          return false; 
        }
      },
    });
  });

  sleep(0.5);

  // ─── Anamnesis ────────────────────────────────────────────────────────────
  group('Anamnesis', () => {
    const res = http.get(`${BASE_URL}/anamnesis`, { headers });
    check(res, {
      '[smoke][anamnesis] GET /anamnesis → 200': (r) => r.status === 200,
      '[smoke][anamnesis] resposta é array': (r) => {
        try { 
          return Array.isArray(JSON.parse(r.body)); 
        } catch (e) { 
          return false; 
        }
      },
    });
  });

  sleep(0.5);

  // ─── Plans Education ──────────────────────────────────────────────────────
  group('Plans Education', () => {
    const res = http.get(`${BASE_URL}/plans-education`, { headers });
    check(res, {
      '[smoke][plans-education] GET /plans-education → 200': (r) => r.status === 200,
      '[smoke][plans-education] resposta é array': (r) => {
        try { 
          return Array.isArray(JSON.parse(r.body)); 
        } catch(e) { 
          return false; 
        }
      },
    });
  });

  sleep(1);
}

export function teardown(data) {
  console.log('✅ Smoke test concluído. Todos os endpoints verificados.');
}
