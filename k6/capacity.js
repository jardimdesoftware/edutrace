import publicScenario, { handleSummary } from './tests/load/production-public.test.js';

export const options = {
  discardResponseBodies: true,
  scenarios: {
    users_50: {
      executor: 'constant-vus', exec: 'publicScenario', vus: 50,
      duration: '20s', startTime: '0s', gracefulStop: '2s', tags: { load: '50' },
    },
    users_100: {
      executor: 'constant-vus', exec: 'publicScenario', vus: 100,
      duration: '20s', startTime: '25s', gracefulStop: '2s', tags: { load: '100' },
    },
    users_150: {
      executor: 'constant-vus', exec: 'publicScenario', vus: 150,
      duration: '20s', startTime: '50s', gracefulStop: '2s', tags: { load: '150' },
    },
    users_200: {
      executor: 'constant-vus', exec: 'publicScenario', vus: 200,
      duration: '20s', startTime: '75s', gracefulStop: '2s', tags: { load: '200' },
    },
  },
  thresholds: {
    http_req_failed: [
      { threshold: 'rate<0.02', abortOnFail: true, delayAbortEval: '15s' },
    ],
    'http_req_duration{load:50}': ['p(95)<750'],
    'http_req_duration{load:100}': ['p(95)<750'],
    'http_req_duration{load:150}': ['p(95)<750'],
    'http_req_duration{load:200}': ['p(95)<750'],
    checks: [
      { threshold: 'rate>0.98', abortOnFail: true, delayAbortEval: '15s' },
    ],
  },
};

export default publicScenario;
export { publicScenario, handleSummary };
