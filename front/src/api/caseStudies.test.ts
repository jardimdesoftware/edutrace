import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CaseStudySections } from '@/interfaces/CaseStudy';
import {
  createCaseStudy,
  deleteCaseStudy,
  getCaseStudy,
  updateCaseStudy,
} from './caseStudies';

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

const secoes = { barriers: 'Ruído na sala' } as unknown as CaseStudySections;

describe('getCaseStudy', () => {
  it('reads the case study of the student with a GET, encoding the e-mail in the path', async () => {
    const estudo = { barriers: 'Ruído na sala', author: null };
    respondWith(200, estudo);

    const resultado = await getCaseStudy(EMAIL);

    assert.deepEqual(resultado, estudo);
    assert.equal(calls[0].url, `${API_URL}/case-studies/${ENCODED}`);
    assert.equal(calls[0].init.method, 'GET');
  });

  it('returns null when the student has no case study', async () => {
    respondWith(404, { message: 'Estudo de caso não encontrado' });

    assert.equal(await getCaseStudy('aluno@edutrace.com'), null);
  });

  it('rejects with the API message when the student reads the case study of another', async () => {
    respondWith(403, { message: 'Acesso negado' });

    await assert.rejects(getCaseStudy('outro@edutrace.com'), { message: 'Acesso negado' });
  });

  it('rejects, instead of returning null, when the API fails', async () => {
    respondWith(500, { message: 'Erro interno' });

    await assert.rejects(getCaseStudy('aluno@edutrace.com'), { message: 'Erro interno' });
  });
});

describe('createCaseStudy', () => {
  it('sends the e-mail of the student with the sections in a POST', async () => {
    respondWith(201, {});

    await createCaseStudy('aluno@edutrace.com', secoes);

    assert.equal(calls[0].url, `${API_URL}/case-studies`);
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(
      calls[0].init.body,
      JSON.stringify({ student_email: 'aluno@edutrace.com', barriers: 'Ruído na sala' }),
    );
  });

  it('rejects with the API message when the student already has a case study', async () => {
    respondWith(409, { message: 'O estudante já possui estudo de caso' });

    await assert.rejects(createCaseStudy('aluno@edutrace.com', secoes), {
      message: 'O estudante já possui estudo de caso',
    });
  });
});

describe('updateCaseStudy', () => {
  it('sends the sections in a PATCH to the path of the student', async () => {
    respondWith(200, {});

    await updateCaseStudy(EMAIL, secoes);

    assert.equal(calls[0].url, `${API_URL}/case-studies/${ENCODED}`);
    assert.equal(calls[0].init.method, 'PATCH');
    assert.equal(calls[0].init.body, JSON.stringify({ barriers: 'Ruído na sala' }));
  });

  it('rejects with the API message when the level cannot write', async () => {
    respondWith(403, { message: 'Nível de acesso insuficiente' });

    await assert.rejects(updateCaseStudy('aluno@edutrace.com', secoes), {
      message: 'Nível de acesso insuficiente',
    });
  });
});

describe('deleteCaseStudy', () => {
  it('sends a DELETE to the path of the student', async () => {
    respondWith(200, {});

    await deleteCaseStudy(EMAIL);

    assert.equal(calls[0].url, `${API_URL}/case-studies/${ENCODED}`);
    assert.equal(calls[0].init.method, 'DELETE');
  });
});
