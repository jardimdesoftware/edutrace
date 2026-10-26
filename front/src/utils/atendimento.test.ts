import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  contarPorStatus,
  filtrarPorStatus,
  OPCOES_FILTRO_STATUS,
  podeAssumirAtendimento,
  podeEncerrarAtendimento,
  rotuloDoResponsavel,
  rotuloDoStatus,
  textoDaContagem,
} from './atendimento';
import type { ServiceStatus, StudentData } from '../interfaces/StudentData';
import {
  ADMIN,
  ESTUDANTE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_NAPNE,
  PROFISSIONAL_SAUDE,
} from '../consts';

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

function estudante(id: number, status: ServiceStatus | null, extra: Partial<StudentData> = {}) {
  return usuario(id, { service_status: status, ...extra });
}

const NAPNE_RESPONSAVEL = { id: 7, full_name: 'Maria NAPNE' };

describe('rotuloDoStatus', () => {
  for (const [status, rotulo] of [
    ['WAITING', 'Fila de espera'],
    ['IN_SERVICE', 'Em atendimento'],
    ['CLOSED', 'Encerrado'],
  ] as const) {
    it(`names ${status} as "${rotulo}"`, () => {
      assert.equal(rotuloDoStatus(status), rotulo);
    });
  }

  it('returns no text for a user that has no service status', () => {
    assert.equal(rotuloDoStatus(null), '');
    assert.equal(rotuloDoStatus(undefined), '');
  });
});

describe('rotuloDoResponsavel', () => {
  it('calls the NAPNE of a closed service "Atendido por"', () => {
    assert.equal(rotuloDoResponsavel('CLOSED'), 'Atendido por');
  });

  for (const status of ['WAITING', 'IN_SERVICE'] as const) {
    it(`calls the NAPNE of a ${status} row "Responsável"`, () => {
      assert.equal(rotuloDoResponsavel(status), 'Responsável');
    });
  }
});

describe('OPCOES_FILTRO_STATUS', () => {
  it('offers "Todos" first and then one option per status', () => {
    assert.deepEqual(OPCOES_FILTRO_STATUS, [
      { value: 'TODOS', label: 'Todos' },
      { value: 'WAITING', label: 'Fila de espera' },
      { value: 'IN_SERVICE', label: 'Em atendimento' },
      { value: 'CLOSED', label: 'Encerrado' },
    ]);
  });
});

describe('filtrarPorStatus', () => {
  const lista = [
    estudante(1, 'CLOSED'),
    estudante(2, 'IN_SERVICE', { napne_responsible: NAPNE_RESPONSAVEL }),
    usuario(3, { id_level: PROFISSIONAL_SAUDE, service_status: null }),
    estudante(4, 'WAITING', { queued_at: '2026-10-10T12:00:00.000Z' }),
    estudante(5, 'IN_SERVICE', { napne_responsible: NAPNE_RESPONSAVEL }),
  ];

  it('keeps every row, including the ones without status, for "TODOS"', () => {
    assert.deepEqual(
      filtrarPorStatus(lista, 'TODOS').map((u) => u.id),
      [1, 2, 3, 4, 5],
    );
  });

  it('keeps only the rows of the chosen status and the order of the list', () => {
    assert.deepEqual(
      filtrarPorStatus(lista, 'IN_SERVICE').map((u) => u.id),
      [2, 5],
    );
    assert.deepEqual(
      filtrarPorStatus(lista, 'CLOSED').map((u) => u.id),
      [1],
    );
  });

  it('drops the rows without status when a status is chosen', () => {
    assert.ok(!filtrarPorStatus(lista, 'WAITING').some((u) => u.id === 3));
  });

  it('returns an empty list when nobody has the chosen status', () => {
    assert.deepEqual(filtrarPorStatus([estudante(1, 'CLOSED')], 'WAITING'), []);
  });

  it('orders the queue by queued_at, oldest first, whatever the order of the list', () => {
    const fila = [
      estudante(1, 'WAITING', { queued_at: '2026-10-12T09:00:00.000Z' }),
      estudante(2, 'WAITING', { queued_at: '2026-10-10T09:00:00.000Z' }),
      estudante(3, 'WAITING', { queued_at: '2026-10-11T09:00:00.000Z' }),
    ];

    assert.deepEqual(
      filtrarPorStatus(fila, 'WAITING').map((u) => u.id),
      [2, 3, 1],
    );
  });

  it('orders the queue by the instant, and not by the text of the date', () => {
    const fila = [
      estudante(1, 'WAITING', { queued_at: '2026-10-10T10:00:00.000-03:00' }),
      estudante(2, 'WAITING', { queued_at: '2026-10-10T12:00:00.000Z' }),
    ];

    assert.deepEqual(
      filtrarPorStatus(fila, 'WAITING').map((u) => u.id),
      [2, 1],
    );
  });

  it('puts a queue row without queued_at last and keeps the ties in order', () => {
    const fila = [
      estudante(1, 'WAITING', { queued_at: null }),
      estudante(2, 'WAITING', { queued_at: '2026-10-10T09:00:00.000Z' }),
      estudante(3, 'WAITING', { queued_at: '2026-10-10T09:00:00.000Z' }),
    ];

    assert.deepEqual(
      filtrarPorStatus(fila, 'WAITING').map((u) => u.id),
      [2, 3, 1],
    );
  });

  it('does not reorder the list for the other filters', () => {
    const outros = [
      estudante(1, 'IN_SERVICE', { queued_at: '2026-10-12T09:00:00.000Z' }),
      estudante(2, 'IN_SERVICE', { queued_at: '2026-10-10T09:00:00.000Z' }),
    ];

    assert.deepEqual(
      filtrarPorStatus(outros, 'IN_SERVICE').map((u) => u.id),
      [1, 2],
    );
  });

  it('returns a new list and leaves the original one untouched', () => {
    const fila = [
      estudante(1, 'WAITING', { queued_at: '2026-10-12T09:00:00.000Z' }),
      estudante(2, 'WAITING', { queued_at: '2026-10-10T09:00:00.000Z' }),
    ];
    const copia = [...fila];

    const todos = filtrarPorStatus(fila, 'TODOS');
    const espera = filtrarPorStatus(fila, 'WAITING');

    assert.notEqual(todos, fila);
    assert.notEqual(espera, fila);
    assert.deepEqual(fila, copia);
  });
});

describe('contarPorStatus', () => {
  it('counts the rows of each status', () => {
    const lista = [
      estudante(1, 'WAITING'),
      estudante(2, 'WAITING'),
      estudante(3, 'IN_SERVICE'),
      estudante(4, 'CLOSED'),
      estudante(5, 'WAITING'),
    ];

    assert.deepEqual(contarPorStatus(lista), {
      WAITING: 3,
      IN_SERVICE: 1,
      CLOSED: 1,
    });
  });

  it('ignores the users that are not students, who have no status', () => {
    const lista = [
      estudante(1, 'WAITING'),
      usuario(2, { id_level: ADMIN, service_status: null }),
      usuario(3, { id_level: PROFISSIONAL_NAPNE }),
      usuario(4, { id_level: PROFISSIONAL_EDUCACAO, service_status: null }),
    ];

    assert.deepEqual(contarPorStatus(lista), {
      WAITING: 1,
      IN_SERVICE: 0,
      CLOSED: 0,
    });
  });

  it('returns zero for every status on an empty list', () => {
    assert.deepEqual(contarPorStatus([]), { WAITING: 0, IN_SERVICE: 0, CLOSED: 0 });
  });
});

describe('textoDaContagem', () => {
  it('writes the count of each status separated by a middle dot', () => {
    assert.equal(
      textoDaContagem({ WAITING: 4, IN_SERVICE: 2, CLOSED: 1 }),
      'Fila de espera: 4 · Em atendimento: 2 · Encerrado: 1',
    );
  });

  it('writes the zeros too', () => {
    assert.equal(
      textoDaContagem({ WAITING: 0, IN_SERVICE: 0, CLOSED: 0 }),
      'Fila de espera: 0 · Em atendimento: 0 · Encerrado: 0',
    );
  });
});

describe('podeAssumirAtendimento', () => {
  const napne = { sub: 7, id_level: PROFISSIONAL_NAPNE };

  it('lets the NAPNE take a student of the queue', () => {
    assert.equal(podeAssumirAtendimento(estudante(1, 'WAITING'), napne), true);
  });

  for (const status of ['IN_SERVICE', 'CLOSED', null] as const) {
    it(`does not let the NAPNE take a row with status ${status}`, () => {
      assert.equal(podeAssumirAtendimento(estudante(1, status), napne), false);
    });
  }

  for (const [nome, nivel] of [
    ['administrator', ADMIN],
    ['education professional', PROFISSIONAL_EDUCACAO],
    ['health professional', PROFISSIONAL_SAUDE],
    ['student', ESTUDANTE],
  ] as const) {
    it(`does not let the ${nome} take a student of the queue`, () => {
      assert.equal(
        podeAssumirAtendimento(estudante(1, 'WAITING'), { sub: 7, id_level: nivel }),
        false,
      );
    });
  }

  it('does not let a session without user take a student of the queue', () => {
    assert.equal(podeAssumirAtendimento(estudante(1, 'WAITING'), null), false);
    assert.equal(podeAssumirAtendimento(estudante(1, 'WAITING'), undefined), false);
  });
});

describe('podeEncerrarAtendimento', () => {
  const napne = { sub: 7, id_level: PROFISSIONAL_NAPNE };
  const emAtendimento = estudante(1, 'IN_SERVICE', { napne_responsible: NAPNE_RESPONSAVEL });

  it('lets the NAPNE close the service of a student that is theirs', () => {
    assert.equal(podeEncerrarAtendimento(emAtendimento, napne), true);
  });

  it('does not let the NAPNE close the service of another NAPNE', () => {
    assert.equal(
      podeEncerrarAtendimento(emAtendimento, { sub: 8, id_level: PROFISSIONAL_NAPNE }),
      false,
    );
  });

  it('does not let the NAPNE close a student without responsible', () => {
    const semResponsavel = estudante(1, 'IN_SERVICE', { napne_responsible: null });

    assert.equal(podeEncerrarAtendimento(semResponsavel, napne), false);
    assert.equal(
      podeEncerrarAtendimento(estudante(1, 'IN_SERVICE'), napne),
      false,
    );
  });

  for (const status of ['WAITING', 'CLOSED', null] as const) {
    it(`does not let the NAPNE close a row with status ${status}`, () => {
      const linha = estudante(1, status, { napne_responsible: NAPNE_RESPONSAVEL });

      assert.equal(podeEncerrarAtendimento(linha, napne), false);
    });
  }

  it('does not show the close action to a user that is not NAPNE, even with the same id', () => {
    assert.equal(
      podeEncerrarAtendimento(emAtendimento, { sub: 7, id_level: ADMIN }),
      false,
    );
  });

  it('does not let a session without user close a service', () => {
    assert.equal(podeEncerrarAtendimento(emAtendimento, null), false);
    assert.equal(podeEncerrarAtendimento(emAtendimento, undefined), false);
  });
});
