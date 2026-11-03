import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createUserByAdmin, login, loginWithGoogle } from './login';
import { buildRegisterData } from '@/utils/registerForm';

const API_URL = 'http://api.test';

let calls: { url: string; init: RequestInit }[];
let storageWrites: string[];
let originalFetch: typeof fetch;

beforeEach(() => {
  calls = [];
  storageWrites = [];
  originalFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_API_EDU_TRACE = API_URL;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { setItem: (key: string) => storageWrites.push(key) },
  });
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ message: 'Sessão iniciada.' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('login', () => {
  it('posts the credentials and leaves the session to the HttpOnly cookie', async () => {
    const result = await login('a@edutrace.com', 'senha');

    assert.deepEqual(result, { message: 'Sessão iniciada.' });
    assert.equal(calls[0].url, `${API_URL}/auth/login`);
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.credentials, 'include');
    assert.deepEqual(storageWrites, []);
  });
});

describe('loginWithGoogle', () => {
  it('posts the Google credential without storing any token', async () => {
    await loginWithGoogle('credencial-google');

    assert.equal(calls[0].url, `${API_URL}/auth/google`);
    assert.equal(calls[0].init.body, JSON.stringify({ credential: 'credencial-google' }));
    assert.deepEqual(storageWrites, []);
  });
});

describe('createUserByAdmin', () => {
  it('posts the roles as a list of numbers built by the form and never an id_level', async () => {
    const form = {
      nome: 'Maria Souza',
      email: 'maria@escola.br',
      cpf: '111.444.777-35',
      roles: [6, 5],
      matricula: '',
      curso: '',
    };
    const resultado = buildRegisterData(form, true);
    assert.ok(resultado.ok);

    await createUserByAdmin(resultado.data);

    const body = JSON.parse(String(calls[0].init.body));
    assert.equal(calls[0].url, `${API_URL}/users`);
    assert.equal(calls[0].init.method, 'POST');
    assert.deepEqual(body.roles, [5, 6]);
    assert.ok(body.roles.every((papel: unknown) => typeof papel === 'number'));
    assert.equal('id_level' in body, false);
  });
});
