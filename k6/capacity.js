import publicScenario, { handleSummary } from './tests/load/production-public.test.js';

export const options = {
  discardResponseBodies: true,
  stages: [
    { duration: '15s', target: 10 },
    { duration: '20s', target: 25 },
    { duration: '20s', target: 50 },
    { duration: '20s', target: 100 },
    { duration: '20s', target: 150 },
    { duration: '20s', target: 200 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_failed: [
      { threshold: 'rate<0.02', abortOnFail: true, delayAbortEval: '15s' },
    ],
    http_req_duration: [
      { threshold: 'p(95)<2000', abortOnFail: true, delayAbortEval: '15s' },
    ],
    checks: [
      { threshold: 'rate>0.98', abortOnFail: true, delayAbortEval: '15s' },
    ],
  },
};

export default publicScenario;
export { handleSummary };
