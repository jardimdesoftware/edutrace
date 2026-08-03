/**
 * Screenings Endpoint Tests — EduTrace k6
 *
 * Endpoints testados:
 *   POST   /screenings
 *   GET    /screenings
 *   GET    /screenings/:email
 *   PATCH  /screenings/:email
 *   DELETE /screenings/:email
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

// Dados de triagem de exemplo baseados no CreateScreeningDto
function buildScreeningPayload(email) {
  return JSON.stringify({
    full_name: 'Estudante k6 Teste',
    email,
    report: 'https://link-do-laudo.com',
    specific_need: {
      deficiencia_fisica: true,
      deficiencia_auditiva: false,
      baixa_visao: false,
      cegueira: false,
      surdocegueira: false,
      transtornos_globais_de_desenvolvimento: false,
      superdotacao: false,
      disturbio_de_aprendizagem: false,
      outros: '',
    },
    special_service: true,
    physical_disability: {
      necessita_de_transcritor: false,
      acesso_para_cadeirante: true,
      outros: '',
    },
    visual_impairment: {
      necessita_de_braille: false,
      material_com_fonte_aumentada: false,
      necessita_de_transcritor: false,
      outros: '',
    },
    hearing_impairment: {
      necessita_de_interprete_de_lingua_de_sinais: false,
      necessita_de_interprete_oralizador: false,
      outros: '',
    },
    global_disorder: {
      necessita_de_ledor: false,
      necessita_de_transcritor: false,
      outros: '',
    },
    other_disabilities: '',
  });
}

export default function (data) {
  const headers = authHeaders(data.token);
  const testEmail = `k6.screening.${Date.now()}.${Math.floor(Math.random() * 10000)}@test.com`;

  // ─── 1. POST /screenings ──────────────────────────────────────────────────
  const createRes = http.post(
    `${BASE_URL}/screenings`,
    buildScreeningPayload(testEmail),
    { headers },
  );
  check(createRes, {
    '[screenings] POST /screenings retorna 201': (r) => r.status === 201,
    '[screenings] POST /screenings retorna email correto': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.email === testEmail;
      } catch {
        return false;
      }
    },
  });

  // ─── 2. GET /screenings — listar todas ───────────────────────────────────
  const listRes = http.get(`${BASE_URL}/screenings`, { headers });
  check(listRes, {
    '[screenings] GET /screenings retorna 200': (r) => r.status === 200,
    '[screenings] GET /screenings retorna array': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body));
      } catch {
        return false;
      }
    },
  });

  // ─── 3. GET /screenings/:email ────────────────────────────────────────────
  const getOneRes = http.get(`${BASE_URL}/screenings/${testEmail}`, { headers });
  check(getOneRes, {
    '[screenings] GET /screenings/:email retorna 200': (r) => r.status === 200,
    '[screenings] GET /screenings/:email retorna email correto': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.email === testEmail;
      } catch {
        return false;
      }
    },
  });

  // ─── 4. PATCH /screenings/:email ─────────────────────────────────────────
  const updateRes = http.patch(
    `${BASE_URL}/screenings/${testEmail}`,
    JSON.stringify({ full_name: 'Nome Atualizado k6', special_service: false }),
    { headers },
  );
  check(updateRes, {
    '[screenings] PATCH /screenings/:email retorna 200': (r) => r.status === 200,
  });

  // ─── 5. DELETE /screenings/:email ────────────────────────────────────────
  const deleteRes = http.del(`${BASE_URL}/screenings/${testEmail}`, null, { headers });
  check(deleteRes, {
    '[screenings] DELETE /screenings/:email retorna 200': (r) => r.status === 200,
  });

  sleep(1);
}
