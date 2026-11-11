import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = (__ENV.BASE_URL || 'https://edutrace.ruancarvalho.me').replace(/\/$/, '');

export const options = {
  discardResponseBodies: true,
  stages: [
    { duration: '15s', target: 5 },
    { duration: '30s', target: 10 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '30s' }],
    http_req_duration: ['p(95)<750'],
    'http_req_duration{endpoint:home}': ['p(95)<750'],
    'http_req_duration{endpoint:login}': ['p(95)<750'],
    checks: [{ threshold: 'rate>0.99', abortOnFail: true, delayAbortEval: '30s' }],
  },
};

export default function () {
  const home = http.get(`${baseUrl}/`, { tags: { endpoint: 'home' } });
  check(home, {
    'home responde 2xx/3xx': (response) => response.status >= 200 && response.status < 400,
  });

  const login = http.get(`${baseUrl}/login`, { tags: { endpoint: 'login' } });
  check(login, {
    'login responde 200': (response) => response.status === 200,
  });

  sleep(1);
}

export function handleSummary(data) {
  const summaryPath = __ENV.SUMMARY_PATH || 'evidencias/k6-edutrace-summary.json';
  const requests = data.metrics.http_reqs?.values?.count ?? 0;
  const failureRate = data.metrics.http_req_failed?.values?.rate ?? 0;
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] ?? 0;

  return {
    [summaryPath]: JSON.stringify(data, null, 2),
    stdout: `\nEvidência k6 EduTrace: ${requests} requisições, falhas ${(failureRate * 100).toFixed(2)}%, p95 ${p95.toFixed(2)} ms.\n`,
  };
}
