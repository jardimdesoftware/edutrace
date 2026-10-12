import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getGoogleLinkStatus,
  linkGoogleAccount,
  unlinkGoogleAccount,
} from './googleLink';

const API_URL = 'http://api.test';

type FetchCall = { url: string; init: RequestInit };

let calls: FetchCall[];
let originalFetch: typeof fetch;
let sessionEnded: boolean;

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
  sessionEnded = false;
  originalFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_API_EDU_TRACE = API_URL;
  // endSession limpa o armazenamento e volta para a página inicial.
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { removeItem: () => undefined },
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: {
        replace: () => {
          sessionEnded = true;
        },
      },
    },
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  Reflect.deleteProperty(globalThis, 'window');
  Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('getGoogleLinkStatus', () => {
  it('reads the link status of the session account with a GET', async () => {
    respondWith(200, { enabled: true, linked: false });

    const result = await getGoogleLinkStatus();

    assert.deepEqual(result, { enabled: true, linked: false });
    assert.equal(calls[0].url, `${API_URL}/auth/google/link`);
    assert.equal(calls[0].init.method, 'GET');
  });
});

describe('linkGoogleAccount', () => {
  it('sends the Google credential and the current password in a POST', async () => {
    respondWith(200, { message: 'Conta Google vinculada.' });
    const payload = { credential: 'credencial', currentPassword: 'senhaAtual123' };

    const result = await linkGoogleAccount(payload);

    assert.deepEqual(result, { message: 'Conta Google vinculada.' });
    assert.equal(calls[0].url, `${API_URL}/auth/google/link`);
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.body, JSON.stringify(payload));
  });

  it('keeps the session when the current password is wrong', async () => {
    respondWith(401, { message: 'Senha atual incorreta' });

    await assert.rejects(
      linkGoogleAccount({ credential: 'credencial', currentPassword: 'errada' }),
      { message: 'Senha atual incorreta' },
    );
    assert.equal(sessionEnded, false);
  });

  it('rejects with the API message when the Google account belongs to another account', async () => {
    respondWith(409, {
      message: 'Esta Conta Google já está vinculada a outra conta.',
    });

    await assert.rejects(
      linkGoogleAccount({ credential: 'credencial', currentPassword: 'certa' }),
      { message: 'Esta Conta Google já está vinculada a outra conta.' },
    );
  });
});

describe('unlinkGoogleAccount', () => {
  it('sends a DELETE to the link route', async () => {
    respondWith(200, { message: 'Conta Google desvinculada.' });

    const result = await unlinkGoogleAccount();

    assert.deepEqual(result, { message: 'Conta Google desvinculada.' });
    assert.equal(calls[0].url, `${API_URL}/auth/google/link`);
    assert.equal(calls[0].init.method, 'DELETE');
  });
});
