import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  listComments,
  postComment,
  updateComment,
  type EditCommentPayload,
} from './comments';

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

describe('postComment', () => {
  it('sends the comment, the student, the type and the email option in a POST', async () => {
    const saved = { id: 1, comment: 'nova anotação', type: 'NOTE', edits: [] };
    respondWith(201, saved);

    const result = await postComment({
      comment: 'nova anotação',
      id_user: 10,
      type: 'NOTE',
      notify_by_email: true,
    });

    assert.deepEqual(result, saved);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${API_URL}/comments`);
    assert.equal(calls[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(calls[0].init.body as string), {
      comment: 'nova anotação',
      id_user: 10,
      type: 'NOTE',
      notify_by_email: true,
    });
  });

  it('sends the class council report type as the enum string', async () => {
    respondWith(201, { id: 2, type: 'CLASS_COUNCIL_REPORT' });

    await postComment({
      comment: 'relatório do conselho',
      id_user: 10,
      type: 'CLASS_COUNCIL_REPORT',
    });

    const corpo = JSON.parse(calls[0].init.body as string);
    assert.equal(corpo.type, 'CLASS_COUNCIL_REPORT');
    assert.equal(typeof corpo.type, 'string');
  });
});

describe('updateComment', () => {
  it('sends only the new text and the email option in a PATCH to the comment id', async () => {
    const updated = {
      id: 7,
      comment: 'texto editado',
      edits: [{ id: 1, comment: 'texto original' }],
    };
    respondWith(200, updated);

    const result = await updateComment(7, {
      comment: 'texto editado',
      notify_by_email: false,
    });

    assert.deepEqual(result, updated);
    assert.equal(calls[0].url, `${API_URL}/comments/7`);
    assert.equal(calls[0].init.method, 'PATCH');
    assert.deepEqual(JSON.parse(calls[0].init.body as string), {
      comment: 'texto editado',
      notify_by_email: false,
    });
  });

  it('never sends the type in the PATCH, even when the payload carries one, because the API answers 400', async () => {
    respondWith(200, { id: 7, type: 'CLASS_COUNCIL_REPORT' });
    // O tipo vem do registro do GET; o cast simula quem espalha o registro no corpo.
    const comTipo = {
      comment: 'texto editado',
      notify_by_email: true,
      type: 'CLASS_COUNCIL_REPORT',
    } as unknown as EditCommentPayload;

    await updateComment(7, comTipo);

    const corpo = JSON.parse(calls[0].init.body as string);
    assert.equal('type' in corpo, false);
    assert.deepEqual(corpo, { comment: 'texto editado', notify_by_email: true });
  });

  it('rejects with the API message when the author is not allowed to edit', async () => {
    respondWith(403, {
      message: 'Você só pode editar as anotações que você mesmo criou',
    });

    await assert.rejects(updateComment(7, { comment: 'texto' }), {
      message: 'Você só pode editar as anotações que você mesmo criou',
    });
  });
});

describe('listComments', () => {
  const pagina = {
    items: [{ id: 9, comment: 'texto', type: 'NOTE', edits: [] }],
    next_cursor: 9,
    total: 3,
    overall: 5,
    authors: [{ id: 7, name: 'Professora Ana' }],
  };

  it('requests the page of the student with a GET, no body and no query when there is none', async () => {
    respondWith(200, pagina);

    const result = await listComments(3, {});

    assert.deepEqual(result, pagina);
    assert.equal(calls[0].url, `${API_URL}/comments/3`);
    assert.equal(calls[0].init.method, 'GET');
    assert.equal(calls[0].init.body, undefined);
  });

  it('puts every parameter of the query in the URL, with the exact name and value', async () => {
    respondWith(200, pagina);

    await listComments(3, {
      q: 'acao',
      author: 7,
      area: 4,
      type: 'CLASS_COUNCIL_REPORT',
      from: '2026-10-01T03:00:00.000Z',
      to: '2026-10-02T03:00:00.000Z',
      edited: true,
      cursor: 90,
      limit: 20,
    });

    const url = new URL(calls[0].url);
    assert.equal(url.origin + url.pathname, `${API_URL}/comments/3`);
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      q: 'acao',
      author: '7',
      area: '4',
      type: 'CLASS_COUNCIL_REPORT',
      from: '2026-10-01T03:00:00.000Z',
      to: '2026-10-02T03:00:00.000Z',
      edited: 'true',
      cursor: '90',
      limit: '20',
    });
  });

  it('leaves out the parameters that are undefined', async () => {
    respondWith(200, pagina);

    await listComments(3, { q: undefined, author: 7, cursor: undefined });

    assert.equal(calls[0].url, `${API_URL}/comments/3?author=7`);
  });

  it('encodes the search so that &, =, #, % and + stay text and cannot add a parameter', async () => {
    respondWith(200, pagina);
    const busca = 'a&type=NOTE b=c #d 100% +ç ?x';

    await listComments(3, { q: busca });

    const url = new URL(calls[0].url);
    assert.equal(url.searchParams.get('q'), busca);
    assert.deepEqual([...url.searchParams.keys()], ['q']);
    assert.equal(url.hash, '');
    assert.equal(calls[0].url.includes('#'), false);
  });

  it('rejects with the API message when the student is not the user', async () => {
    respondWith(403, { message: 'Você só pode ver as suas próprias anotações' });

    await assert.rejects(listComments(3, {}), {
      message: 'Você só pode ver as suas próprias anotações',
    });
  });

  it('rejects with the API message when the query is refused', async () => {
    respondWith(400, { message: ['q deve ter no máximo 200 caracteres.', 'limit inválido'] });

    await assert.rejects(listComments(3, { q: 'x' }), {
      message: 'q deve ter no máximo 200 caracteres. limit inválido',
    });
  });
});
