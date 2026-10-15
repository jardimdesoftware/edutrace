import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buscarUsuarioPorId,
  resolverEstudanteDaUrl,
  rotaDoEstudante,
} from './estudanteDaUrl';
import { ADMIN, PROFISSIONAL_SAUDE } from '../consts';

const API_URL = 'http://api.test';

const usuarios = [
  { id: 3, full_name: 'Estudante A', email: 'a@edutrace.com', id_level: 2 },
  { id: 7, full_name: 'Estudante B', email: 'b@edutrace.com', id_level: 2 },
];

let urls: string[];
let originalFetch: typeof fetch;

beforeEach(() => {
  urls = [];
  originalFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_API_EDU_TRACE = API_URL;
  globalThis.fetch = (async (url: string) => {
    urls.push(url);
    return new Response(JSON.stringify(usuarios), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('rotaDoEstudante', () => {
  it('puts only the id in the query string', () => {
    assert.equal(rotaDoEstudante('/triagem', 7), '/triagem?id=7');
  });

  it('encodes the id taken from the URL', () => {
    assert.equal(rotaDoEstudante('/pei', '7&email=a'), '/pei?id=7%26email%3Da');
  });

  for (const vazio of [null, undefined, '']) {
    it(`returns the bare path when the id is ${JSON.stringify(vazio)}`, () => {
      assert.equal(rotaDoEstudante('/anamnese', vazio), '/anamnese');
    });
  }
});

describe('buscarUsuarioPorId', () => {
  it('finds the student among the students listed for a professional', async () => {
    const usuario = await buscarUsuarioPorId('7', PROFISSIONAL_SAUDE);

    assert.deepEqual(usuario, usuarios[1]);
    assert.deepEqual(urls, [`${API_URL}/students`]);
  });

  it('searches every user when the session is the administrator', async () => {
    await buscarUsuarioPorId('3', ADMIN);

    assert.deepEqual(urls, [`${API_URL}/users`]);
  });

  it('returns null when no listed user has the id', async () => {
    assert.equal(await buscarUsuarioPorId('99', PROFISSIONAL_SAUDE), null);
  });

  for (const invalido of [null, '', 'abc', '3.5', '0', '-3']) {
    it(`returns null without calling the API for the id ${JSON.stringify(invalido)}`, async () => {
      assert.equal(await buscarUsuarioPorId(invalido, PROFISSIONAL_SAUDE), null);
      assert.deepEqual(urls, []);
    });
  }
});

describe('resolverEstudanteDaUrl', () => {
  it('returns the record of the student found by the id', async () => {
    assert.deepEqual(await resolverEstudanteDaUrl('7', PROFISSIONAL_SAUDE), {
      registro: usuarios[1],
    });
  });

  it('returns the not found alert when no listed user has the id', async () => {
    assert.deepEqual(await resolverEstudanteDaUrl('99', PROFISSIONAL_SAUDE), {
      alerta: {
        title: 'Estudante não encontrado',
        text: 'O estudante não existe ou você não tem acesso a ele.',
        icon: 'error',
      },
    });
  });

  it('returns the API error message in the alert when the lookup fails', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: 'Falha ao listar estudantes' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;
    const consoleError = console.error;
    console.error = () => {};

    try {
      assert.deepEqual(await resolverEstudanteDaUrl('7', PROFISSIONAL_SAUDE), {
        alerta: {
          title: 'Estudante não encontrado',
          text: 'Falha ao listar estudantes',
          icon: 'error',
        },
      });
    } finally {
      console.error = consoleError;
    }
  });
});
