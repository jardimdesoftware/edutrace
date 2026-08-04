/**
 * Configurações centralizadas para os testes k6 do EduTrace.
 *
 * Thresholds:
 *  - http_req_duration: 95% das requisições devem responder em < 500ms
 *  - http_req_failed:   menos de 1% das requisições podem falhar
 */

// ─── Thresholds padrão ───────────────────────────────────────────────────────

export const defaultThresholds = {
  http_req_duration: ['p(95)<500'],
  http_req_failed: ['rate<0.01'],
};

export const strictThresholds = {
  http_req_duration: ['p(95)<300', 'p(99)<500'],
  http_req_failed: ['rate<0.005'],
};

// ─── Cenários de estágios ─────────────────────────────────────────────────────

/**
 * Endpoint: usado pelos scripts de k6/tests/endpoints/*.test.js.
 * 1 VU por 30 segundos, thresholds padrão.
 */
export const endpointOptions = {
  vus: 1,
  duration: '30s',
  thresholds: defaultThresholds,
};

/**
 * Smoke: validação rápida com carga mínima.
 * 1 VU por 30 segundos.
 */
export const smokeOptions = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(99)<200'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.95'],
  },
};

/**
 * Load: simula carga normal de produção.
 * Rampa de subida → manutenção → rampa de descida.
 */
export const loadOptions = {
  stages: [
    { duration: '30s', target: 10 }, // ramp-up para 10 VUs
    { duration: '1m',  target: 10 }, // sustenta 10 VUs por 1 min
    { duration: '30s', target: 20 }, // sobe para 20 VUs
    { duration: '1m',  target: 20 }, // sustenta 20 VUs por 1 min
    { duration: '30s', target: 0  }, // ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.95'],
  },
};

/**
 * Stress: aumenta progressivamente para encontrar o limite.
 * Cada estágio dobra a carga anterior.
 */
export const stressOptions = {
  stages: [
    { duration: '30s', target: 10  },
    { duration: '1m',  target: 20  },
    { duration: '30s', target: 40  },
    { duration: '1m',  target: 40  },
    { duration: '30s', target: 80  },
    { duration: '1m',  target: 80  },
    { duration: '30s', target: 0   }, // ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'], // mais tolerante no stress
    http_req_failed: ['rate<0.05'],
  },
};

/**
 * Spike: simula um pico repentino de tráfego.
 */
export const spikeOptions = {
  stages: [
    { duration: '10s', target: 0   },
    { duration: '1s',  target: 100 }, // spike repentino
    { duration: '1m',  target: 100 },
    { duration: '10s', target: 0   }, // queda repentina
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.1'],
  },
};
