import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getAllUsers, getDeletionPreview, updateProfile, updateUser } from './user';

const API_URL = 'http://api.test';

type FetchCall = { url: string; init: RequestInit };

let calls: FetchCall[];
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

describe('getAllUsers', () => {
  it('lists every user from /users with a GET', async () => {
    const users = [
      { id: 1, email: 'admin@edutrace.com', roles: [1] },
      { id: 3, email: 'estudante@edutrace.com', roles: [2] },
    ];
    respondWith(200, users);

    const result = await getAllUsers();

    assert.deepEqual(result, users);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${API_URL}/users`);
    assert.equal(calls[0].init.method, 'GET');
  });

  it('asks for the grace period or the deactivated users with the situation in the query', async () => {
    respondWith(200, []);

    await getAllUsers('carencia');
    await getAllUsers('desativados');

    assert.equal(calls[0].url, `${API_URL}/users?situation=carencia`);
    assert.equal(calls[1].url, `${API_URL}/users?situation=desativados`);
  });

  it('sends no query for the default list, which already hides the deactivated users', async () => {
    respondWith(200, []);

    await getAllUsers('padrao');

    assert.equal(calls[0].url, `${API_URL}/users`);
  });

  it('rejects with the API message when the level is not allowed', async () => {
    respondWith(403, { message: 'Nível de acesso insuficiente' });

    await assert.rejects(getAllUsers(), {
      message: 'Nível de acesso insuficiente',
    });
  });
});

describe('updateProfile', () => {
  let storageWrites: string[];

  beforeEach(() => {
    storageWrites = [];
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { setItem: (key: string) => storageWrites.push(key) },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('sends a PATCH to /auth/me and leaves the new token to the session cookie', async () => {
    respondWith(200, { message: 'Dados atualizados.' });
    const payload = { password: 'novaSenha123', currentPassword: 'senhaAtual123' };

    const result = await updateProfile(payload);

    assert.deepEqual(result, { message: 'Dados atualizados.' });
    assert.equal(calls[0].url, `${API_URL}/auth/me`);
    assert.equal(calls[0].init.method, 'PATCH');
    assert.equal(calls[0].init.body, JSON.stringify(payload));
    assert.deepEqual(storageWrites, []);
  });

  it('rejects with the API message when the current password is wrong', async () => {
    respondWith(401, { message: 'Senha atual incorreta' });

    await assert.rejects(updateProfile({ currentPassword: 'errada' }), {
      message: 'Senha atual incorreta',
    });
  });
});

describe('updateUser', () => {
  it('encodes the e-mail in the path', async () => {
    respondWith(200, {});

    await updateUser('nome/sobrenome?x#y@edutrace.com', [3]);

    assert.equal(
      calls[0].url,
      `${API_URL}/users/nome%2Fsobrenome%3Fx%23y%40edutrace.com`,
    );
    assert.equal(calls[0].init.body, JSON.stringify({ roles: [3] }));
  });

  it('sends the roles as a list of numbers and never an id_level', async () => {
    respondWith(200, {});

    await updateUser('napne@edutrace.com', [5, 6]);

    const body = JSON.parse(String(calls[0].init.body));
    assert.equal(calls[0].init.method, 'PATCH');
    assert.deepEqual(body, { roles: [5, 6] });
    assert.equal('id_level' in body, false);
  });
});

describe('getDeletionPreview', () => {
  it('asks the back whether the account has data, by the id', async () => {
    respondWith(200, { has_data: true });

    const result = await getDeletionPreview(7);

    assert.deepEqual(result, { has_data: true });
    assert.equal(calls[0].url, `${API_URL}/users/7/deletion-preview`);
    assert.equal(calls[0].init.method, 'GET');
  });

  it('rejects with the API message when the level is not allowed', async () => {
    respondWith(403, { message: 'Nível de acesso insuficiente' });

    await assert.rejects(getDeletionPreview(7), {
      message: 'Nível de acesso insuficiente',
    });
  });
});
