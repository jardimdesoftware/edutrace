import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getPedagogicalManagerOptions, updatePedagogicalManager } from './pedagogicalManager';

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

describe('getPedagogicalManagerOptions', () => {
  it('lists the servers from /students/pedagogical-manager-options with a GET', async () => {
    const opcoes = [
      { id: 4, full_name: 'Ana Educação', roles: [3] },
      { id: 9, full_name: 'Bia NAPNE', roles: [5, 6] },
    ];
    respondWith(200, opcoes);

    const result = await getPedagogicalManagerOptions();

    assert.deepEqual(result, opcoes);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${API_URL}/students/pedagogical-manager-options`);
    assert.equal(calls[0].init.method, 'GET');
  });

  it('rejects with the API message when the level is not allowed', async () => {
    respondWith(403, { message: 'Nível de acesso insuficiente' });

    await assert.rejects(getPedagogicalManagerOptions(), {
      message: 'Nível de acesso insuficiente',
    });
  });
});

describe('updatePedagogicalManager', () => {
  it('sends the payload in a PATCH to the pedagogical-manager path and returns the student', async () => {
    const estudante = { id: 3, email: 'aluno@edutrace.com', pedagogical_manager: { id: 4, full_name: 'Ana Educação' } };
    respondWith(200, estudante);
    const payload = { kind: 'SERVER', user_id: 4 } as const;

    const result = await updatePedagogicalManager('aluno@edutrace.com', payload);

    assert.deepEqual(result, estudante);
    assert.equal(calls[0].url, `${API_URL}/students/aluno%40edutrace.com/pedagogical-manager`);
    assert.equal(calls[0].init.method, 'PATCH');
    assert.equal(calls[0].init.body, JSON.stringify(payload));
  });

  it('encodes the e-mail in the path', async () => {
    respondWith(200, {});

    await updatePedagogicalManager('nome/sobrenome?x#y@edutrace.com', { kind: 'NONE' });

    assert.equal(
      calls[0].url,
      `${API_URL}/students/nome%2Fsobrenome%3Fx%23y%40edutrace.com/pedagogical-manager`,
    );
  });

  it('sends the external person with name, phone and CPF', async () => {
    respondWith(200, {});
    const payload = {
      kind: 'EXTERNAL',
      name: 'João Externo',
      phone: '11987654321',
      cpf: '12345678909',
    } as const;

    await updatePedagogicalManager('aluno@edutrace.com', payload);

    assert.equal(calls[0].init.body, JSON.stringify(payload));
  });

  it('rejects with the API message when the server has an invalid level', async () => {
    respondWith(400, { message: 'O responsável deve ser um Profissional da Educação ou NAPNE' });

    await assert.rejects(updatePedagogicalManager('aluno@edutrace.com', { kind: 'SERVER', user_id: 1 }), {
      message: 'O responsável deve ser um Profissional da Educação ou NAPNE',
    });
  });

  it('joins the validation messages the API sends as a list', async () => {
    respondWith(400, { message: ['CPF inválido', 'Telefone inválido'] });

    await assert.rejects(
      updatePedagogicalManager('aluno@edutrace.com', {
        kind: 'EXTERNAL',
        name: 'João',
        phone: '1',
        cpf: '1',
      }),
      { message: 'CPF inválido Telefone inválido' },
    );
  });
});
