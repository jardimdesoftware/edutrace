import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchSessionUser } from './sessionUser';

const API_URL = 'http://api.test';

let calls: { url: string; init: RequestInit }[];
let originalFetch: typeof fetch;

function respondWith(status: number, data: unknown) {
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

beforeEach(() => {
  calls = [];
  originalFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_API_EDU_TRACE = API_URL;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('fetchSessionUser', () => {
  it('asks the back who the session user is, sending the session cookie', async () => {
    const profile = { sub: 7, email: 'prof@edutrace.com', name: 'Prof', roles: [4] };
    respondWith(200, profile);

    const user = await fetchSessionUser();

    assert.deepEqual(user, profile);
    assert.equal(calls[0].url, `${API_URL}/auth/profile`);
    assert.equal(calls[0].init.method, 'GET');
    assert.equal(calls[0].init.credentials, 'include');
  });

  it('returns null when there is no valid session', async () => {
    respondWith(401, { message: 'Unauthorized' });

    assert.equal(await fetchSessionUser(), null);
  });

  it('returns null when the API is unreachable', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;

    assert.equal(await fetchSessionUser(), null);
  });
});
