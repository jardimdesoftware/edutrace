import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  listarUsuariosDaTabela,
  podeExportarRelatorio,
  responsavelDaLinha,
  substituirUsuario,
} from './tabelaUsuarios';
import { SEM_RESPONSAVEL } from './responsavelPedagogico';
import type { StudentData } from '../interfaces/StudentData';
import {
  ADMIN,
  ESTUDANTE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_NAPNE,
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
    ['NAPNE professional', PROFISSIONAL_NAPNE],
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
    ['NAPNE professional', PROFISSIONAL_NAPNE],
  ] as const) {
    it(`denies the report for the ${nome}, who has no report`, () => {
      assert.equal(podeExportarRelatorio({ id_level: nivel }), false);
    });
  }
});

describe('responsavelDaLinha', () => {
  it('shows the server, the external person or the placeholder for a student', () => {
    const servidor = {
      id_level: ESTUDANTE,
      pedagogical_manager: { id: 4, full_name: 'Ana Souza' },
    };
    const externo = {
      id_level: ESTUDANTE,
      pedagogical_manager: null,
      external_manager_name: 'Maria da Silva',
    };
    const nenhum = { id_level: ESTUDANTE, pedagogical_manager: null };

    assert.equal(responsavelDaLinha(servidor), 'Ana Souza');
    assert.equal(responsavelDaLinha(externo), 'Maria da Silva');
    assert.equal(responsavelDaLinha(nenhum), SEM_RESPONSAVEL);
  });

  it('leaves the cell empty for the levels that are not students', () => {
    const outrosNiveis = [
      ADMIN,
      PROFISSIONAL_EDUCACAO,
      PROFISSIONAL_SAUDE,
      PROFISSIONAL_NAPNE,
    ];

    for (const nivel of outrosNiveis) {
      const linha = { id_level: nivel, pedagogical_manager: null };

      assert.equal(responsavelDaLinha(linha), '', `nível ${nivel}`);
    }
  });
});

function usuario(id: number, extra: Partial<StudentData> = {}): StudentData {
  return {
    id,
    full_name: `Usuário ${id}`,
    cpf: '***.456.789-**',
    email: `usuario${id}@edutrace.com`,
    affliation: null,
    pedagogical_manager: null,
    created_at: '2026-10-01T12:00:00.000Z',
    updated_at: '2026-10-01T12:00:00.000Z',
    deleted_at: null,
    id_level: ESTUDANTE,
    roles: [ESTUDANTE],
    id_current_phase: 1,
    ...extra,
  };
}

describe('substituirUsuario', () => {
  it('replaces the row with the response of the update, not only the changed field', () => {
    const napne = usuario(2, {
      id_level: PROFISSIONAL_NAPNE,
      service_capacity: 5,
    });
    const atualizado = usuario(2, {
      id_level: PROFISSIONAL_SAUDE,
      service_capacity: null,
      updated_at: '2026-10-16T12:00:00.000Z',
    });

    const resultado = substituirUsuario([usuario(1), napne, usuario(3)], atualizado);

    assert.equal(resultado[1], atualizado);
    assert.equal(resultado[1].service_capacity, null);
    assert.equal(resultado[1].updated_at, '2026-10-16T12:00:00.000Z');
  });

  it('shows the queue fields the back set when the level changed', () => {
    const profissional = usuario(2, { id_level: PROFISSIONAL_EDUCACAO });
    const atualizado = usuario(2, {
      id_level: ESTUDANTE,
      service_status: 'WAITING',
      queued_at: '2026-10-16T12:00:00.000Z',
      napne_responsible: null,
    });

    const [resultado] = substituirUsuario([profissional], atualizado);

    assert.equal(resultado.service_status, 'WAITING');
    assert.equal(resultado.queued_at, '2026-10-16T12:00:00.000Z');
  });

  it('keeps the order and the other rows', () => {
    const [primeiro, , terceiro] = [usuario(1), usuario(2), usuario(3)];
    const resultado = substituirUsuario(
      [primeiro, usuario(2), terceiro],
      usuario(2, { id_level: ADMIN }),
    );

    assert.deepEqual(
      resultado.map((u) => u.id),
      [1, 2, 3],
    );
    assert.equal(resultado[0], primeiro);
    assert.equal(resultado[2], terceiro);
  });

  it('returns a new list and leaves the original one untouched', () => {
    const original = [usuario(1), usuario(2)];
    const copia = [...original];

    const resultado = substituirUsuario(original, usuario(2, { id_level: ADMIN }));

    assert.notEqual(resultado, original);
    assert.deepEqual(original, copia);
    assert.equal(original[1].id_level, ESTUDANTE);
  });

  it('does not add a user that is not in the list', () => {
    const original = [usuario(1)];

    const resultado = substituirUsuario(original, usuario(9));

    assert.deepEqual(resultado, original);
  });
});
