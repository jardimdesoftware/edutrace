import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getScreeningByEmail, deleteScreening, patchScreening } from './screenings';

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

describe('screenings', () => {
  it('getScreeningByEmail encodes the e-mail in the path', async () => {
    await getScreeningByEmail(EMAIL);

    assert.deepEqual(urls, [`${API_URL}/screenings/${ENCODED}`]);
  });

  it('deleteScreening encodes the e-mail in the path', async () => {
    await deleteScreening(EMAIL);

    assert.deepEqual(urls, [`${API_URL}/screenings/${ENCODED}`]);
  });

  it('patchScreening encodes the e-mail in the path', async () => {
    await patchScreening({} as never, EMAIL);

    assert.deepEqual(urls, [`${API_URL}/screenings/${ENCODED}`]);
  });
});
