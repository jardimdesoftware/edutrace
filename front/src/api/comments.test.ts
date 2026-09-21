import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAllCommentsByIdUser,
  postComment,
  updateComment,
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
  it('sends the comment, the student and the email option in a POST', async () => {
    const saved = { id: 1, comment: 'nova anotação', edits: [] };
    respondWith(201, saved);

    const result = await postComment({
      comment: 'nova anotação',
      id_user: 10,
      notify_by_email: true,
    });

    assert.deepEqual(result, saved);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${API_URL}/comments`);
    assert.equal(calls[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(calls[0].init.body as string), {
      comment: 'nova anotação',
      id_user: 10,
      notify_by_email: true,
    });
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

  it('rejects with the API message when the author is not allowed to edit', async () => {
    respondWith(403, {
      message: 'Você só pode editar as anotações que você mesmo criou',
    });

    await assert.rejects(updateComment(7, { comment: 'texto' }), {
      message: 'Você só pode editar as anotações que você mesmo criou',
    });
  });
});

describe('getAllCommentsByIdUser', () => {
  it('requests the comments of the student with a GET and no body', async () => {
    respondWith(200, []);

    const result = await getAllCommentsByIdUser(3);

    assert.deepEqual(result, []);
    assert.equal(calls[0].url, `${API_URL}/comments/3`);
    assert.equal(calls[0].init.method, 'GET');
    assert.equal(calls[0].init.body, undefined);
  });
});
