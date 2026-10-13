import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { listarUsuariosDaTabela, podeExportarRelatorio } from './tabelaUsuarios';
import {
  ADMIN,
  ESTUDANTE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_SAUDE,
} from '../consts';

const API_URL = 'http://api.test';

let urls: string[];
let originalFetch: typeof fetch;

beforeEach(() => {
  urls = [];
  originalFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_API_EDU_TRACE = API_URL;
  globalThis.fetch = (async (url: string) => {
    urls.push(url);
    return new Response('[]', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('listarUsuariosDaTabela', () => {
  it('lists every user for the administrator', async () => {
    await listarUsuariosDaTabela(ADMIN);

    assert.deepEqual(urls, [`${API_URL}/users`]);
  });

  for (const [nome, nivel] of [
    ['education professional', PROFISSIONAL_EDUCACAO],
    ['health professional', PROFISSIONAL_SAUDE],
    ['student', ESTUDANTE],
  ] as const) {
    it(`lists only the students for the ${nome}`, async () => {
      await listarUsuariosDaTabela(nivel);

      assert.deepEqual(urls, [`${API_URL}/students`]);
    });
  }

  it('lists only the students when the session has no level', async () => {
    await listarUsuariosDaTabela(undefined);

    assert.deepEqual(urls, [`${API_URL}/students`]);
  });
});

describe('podeExportarRelatorio', () => {
  it('allows the report only for a student', () => {
    assert.equal(podeExportarRelatorio({ id_level: ESTUDANTE }), true);
  });

  for (const [nome, nivel] of [
    ['administrator', ADMIN],
    ['education professional', PROFISSIONAL_EDUCACAO],
    ['health professional', PROFISSIONAL_SAUDE],
  ] as const) {
    it(`denies the report for the ${nome}, who has no report`, () => {
      assert.equal(podeExportarRelatorio({ id_level: nivel }), false);
    });
  }
});
