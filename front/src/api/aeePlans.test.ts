import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AeePlanSections } from '@/interfaces/AeePlan';
import { createAeePlan, deleteAeePlan, listAeePlans, updateAeePlan } from './aeePlans';

const API_URL = 'http://api.test';
// '#' cortaria o resto da URL como fragmento, '?' viraria query string e '/'
// mudaria a rota; os três são válidos na parte local de um e-mail.
const EMAIL = 'nome/sobrenome?x#y@edutrace.com';
const ENCODED = 'nome%2Fsobrenome%3Fx%23y%40edutrace.com';

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

const secoes = { basis: 'Embasamento' } as unknown as AeePlanSections;

describe('listAeePlans', () => {
  it('reads the PAEE list of the student with a GET, encoding the e-mail in the path', async () => {
    const planos = [{ id: 2, semester: '2026.2' }, { id: 1, semester: '2026.1' }];
    respondWith(200, planos);

    const resultado = await listAeePlans(EMAIL);

    assert.deepEqual(resultado, planos);
    assert.equal(calls[0].url, `${API_URL}/aee-plans/${ENCODED}`);
    assert.equal(calls[0].init.method, 'GET');
  });

  it('returns the empty list when the student has no PAEE', async () => {
    respondWith(200, []);

    assert.deepEqual(await listAeePlans('aluno@edutrace.com'), []);
  });

  it('rejects with the API message when the student reads the PAEE of another', async () => {
    respondWith(403, { message: 'Acesso negado' });

    await assert.rejects(listAeePlans('outro@edutrace.com'), { message: 'Acesso negado' });
  });

  it('rejects when the API fails', async () => {
    respondWith(500, { message: 'Erro interno' });

    await assert.rejects(listAeePlans('aluno@edutrace.com'), { message: 'Erro interno' });
  });
});

describe('createAeePlan', () => {
  it('sends the e-mail of the student and the period with the sections in a POST', async () => {
    respondWith(201, {});

    await createAeePlan('aluno@edutrace.com', '2026.1', secoes);

    assert.equal(calls[0].url, `${API_URL}/aee-plans`);
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(
      calls[0].init.body,
      JSON.stringify({ student_email: 'aluno@edutrace.com', semester: '2026.1', basis: 'Embasamento' }),
    );
  });

  it('rejects with the API message when the student already has a PAEE in the period', async () => {
    respondWith(409, { message: 'Este estudante já tem um PAEE neste período letivo.' });

    await assert.rejects(createAeePlan('aluno@edutrace.com', '2026.1', secoes), {
      message: 'Este estudante já tem um PAEE neste período letivo.',
      status: 409,
    });
  });
});

describe('updateAeePlan', () => {
  it('sends the sections, without the period, in a PATCH to the path of the PAEE', async () => {
    respondWith(200, {});

    await updateAeePlan(12, secoes);

    assert.equal(calls[0].url, `${API_URL}/aee-plans/12`);
    assert.equal(calls[0].init.method, 'PATCH');
    assert.equal(calls[0].init.body, JSON.stringify({ basis: 'Embasamento' }));
  });

  it('rejects with the API message when the level cannot write', async () => {
    respondWith(403, { message: 'Nível de acesso insuficiente' });

    await assert.rejects(updateAeePlan(12, secoes), { message: 'Nível de acesso insuficiente' });
  });
});

describe('deleteAeePlan', () => {
  it('sends a DELETE to the path of the PAEE', async () => {
    respondWith(200, {});

    await deleteAeePlan(12);

    assert.equal(calls[0].url, `${API_URL}/aee-plans/12`);
    assert.equal(calls[0].init.method, 'DELETE');
  });
});
