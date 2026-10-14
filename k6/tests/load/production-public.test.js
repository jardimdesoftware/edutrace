import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = (__ENV.BASE_URL || 'https://edutrace.valerialima.me').replace(/\/$/, '');

export const options = {
  stages: [
    { duration: '15s', target: 5 },
    { duration: '30s', target: 10 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<750'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const home = http.get(`${baseUrl}/`);
  check(home, {
    'home responde 2xx/3xx': (response) => response.status >= 200 && response.status < 400,
  });

  const login = http.get(`${baseUrl}/login`);
  check(login, {
    'login responde 200': (response) => response.status === 200,
  });

  sleep(1);
}
