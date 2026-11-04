import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { completeRegistration } from './completeRegistration';

const API_URL = 'http://api.test';

const DADOS = {
  cpf: '01234567890',
  password: 'senhaNovaSegura1',
  enrollment_number: '20261TADS0012',
  course: 'Integrado: Informática',
};

let calls: { url: string; init: RequestInit }[];
let originalFetch: typeof fetch;

beforeEach(() => {
  calls = [];
  originalFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_API_EDU_TRACE = API_URL;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ message: 'Cadastro concluído.' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('completeRegistration', () => {
  it('posts the CPF, the password, the enrollment number and the course with the session cookie', async () => {
    const result = await completeRegistration(DADOS);

    assert.deepEqual(result, { message: 'Cadastro concluído.' });
    assert.equal(calls[0].url, `${API_URL}/auth/complete-registration`);
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.credentials, 'include');
    assert.equal(calls[0].init.body, JSON.stringify(DADOS));
  });

  it('surfaces the message of a CPF that belongs to another account', async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          message: 'Este CPF já está cadastrado. Procure o administrador.',
          statusCode: 409,
        }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      )) as typeof fetch;

    await assert.rejects(completeRegistration(DADOS), {
      message: 'Este CPF já está cadastrado. Procure o administrador.',
    });
  });

  it('surfaces the message of an enrollment number that belongs to another account', async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          message: 'Esta matrícula já está cadastrada. Procure o administrador.',
          statusCode: 409,
        }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      )) as typeof fetch;

    await assert.rejects(completeRegistration(DADOS), {
      message: 'Esta matrícula já está cadastrada. Procure o administrador.',
    });
  });
});
