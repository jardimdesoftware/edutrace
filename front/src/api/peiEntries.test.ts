import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { NewPeiEntryPayload, PeiEntryUpdatePayload } from '@/interfaces/PeiEntry';
import { createPeiEntry, deletePeiEntry, listPeiEntries, updatePeiEntry } from './peiEntries';

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

const novo: NewPeiEntryPayload = {
  student_email: 'aluno@edutrace.com',
  semester: '2026.2',
  subject: 'Matemática',
  adapted_objectives: 'Objetivos',
  prioritized_contents: 'Conteúdos',
  syllabus_adaptations: [{ syllabus_content: 'Funções', adaptation: 'Material concreto' }],
  adapted_methodologies: 'Metodologias',
  adapted_assessments: 'Avaliações',
  adapted_resources: 'Recursos',
  general_notes: 'Observações',
};

const conteudo: PeiEntryUpdatePayload = { general_notes: 'Observações novas' };

describe('listPeiEntries', () => {
  it('reads the PEI entries of the student with a GET, encoding the e-mail in the path', async () => {
    const registros = [{ id: 2, semester: '2026.2' }, { id: 1, semester: '2026.1' }];
    respondWith(200, registros);

    const resultado = await listPeiEntries(EMAIL);

    assert.deepEqual(resultado, registros);
    assert.equal(calls[0].url, `${API_URL}/pei-entries/${ENCODED}`);
    assert.equal(calls[0].init.method, 'GET');
  });

  it('returns the empty list when the student has no PEI entry', async () => {
    respondWith(200, []);

    assert.deepEqual(await listPeiEntries('aluno@edutrace.com'), []);
  });

  it('rejects with the API message when the student reads the PEI of another', async () => {
    respondWith(403, { message: 'Acesso negado' });

    await assert.rejects(listPeiEntries('outro@edutrace.com'), { message: 'Acesso negado' });
  });

  it('rejects when the API fails', async () => {
    respondWith(500, { message: 'Erro interno' });

    await assert.rejects(listPeiEntries('aluno@edutrace.com'), { message: 'Erro interno' });
  });
});

describe('createPeiEntry', () => {
  it('sends the whole body, as it is, in a POST to /pei-entries', async () => {
    respondWith(201, {});

    await createPeiEntry(novo);

    assert.equal(calls[0].url, `${API_URL}/pei-entries`);
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.body, JSON.stringify(novo));
  });

  it('sends the session cookie and the CSRF header, as every request that changes state', async () => {
    respondWith(201, {});

    await createPeiEntry(novo);

    assert.equal(calls[0].init.credentials, 'include');
    assert.equal(
      (calls[0].init.headers as Record<string, string>)['X-Requested-With'],
      'XMLHttpRequest',
    );
  });

  it('rejects with the API message when the entry already exists in the semester and subject', async () => {
    const mensagem = 'Este estudante já tem um registro do PEI desta disciplina neste semestre.';
    respondWith(409, { message: mensagem });

    await assert.rejects(createPeiEntry(novo), { message: mensagem, status: 409 });
  });
});

describe('updatePeiEntry', () => {
  it('sends the content, without semester and subject, in a PATCH to the path of the entry', async () => {
    respondWith(200, {});

    await updatePeiEntry(12, conteudo);

    assert.equal(calls[0].url, `${API_URL}/pei-entries/12`);
    assert.equal(calls[0].init.method, 'PATCH');
    assert.equal(calls[0].init.body, JSON.stringify(conteudo));
  });

  it('rejects with the API message when the entry belongs to another teacher', async () => {
    const mensagem = 'Você só pode alterar os registros do PEI que você mesmo criou';
    respondWith(403, { message: mensagem });

    await assert.rejects(updatePeiEntry(12, conteudo), { message: mensagem, status: 403 });
  });
});

describe('deletePeiEntry', () => {
  it('sends a DELETE to the path of the entry', async () => {
    respondWith(200, {});

    await deletePeiEntry(12);

    assert.equal(calls[0].url, `${API_URL}/pei-entries/12`);
    assert.equal(calls[0].init.method, 'DELETE');
  });

  it('rejects with the API message when the entry does not exist or was already deleted', async () => {
    respondWith(404, { message: 'Registro do PEI não encontrado' });

    await assert.rejects(deletePeiEntry(12), { message: 'Registro do PEI não encontrado', status: 404 });
  });
});
