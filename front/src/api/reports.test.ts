import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getReportByEmail } from './reports';

const API_URL = 'http://api.test';
// '#' cortaria o resto da URL como fragmento, '?' viraria query string e '/'
// mudaria a rota; os três são válidos na parte local de um e-mail.
const EMAIL = 'nome/sobrenome?x#y@edutrace.com';
const ENCODED = 'nome%2Fsobrenome%3Fx%23y%40edutrace.com';

let urls: string[];
let originalFetch: typeof fetch;

beforeEach(() => {
  urls = [];
  originalFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_API_EDU_TRACE = API_URL;
  globalThis.fetch = (async (url: string) => {
    urls.push(url);
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('reports', () => {
  it('getReportByEmail encodes the e-mail in the path', async () => {
    await getReportByEmail(EMAIL);

    assert.deepEqual(urls, [`${API_URL}/reports/${ENCODED}`]);
  });
});
