import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  contarPorStatus,
  filtrarPorStatus,
  OPCOES_FILTRO_STATUS,
  opcoesDoFiltroStatus,
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
  PROFESSOR_AEE,
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
    roles: [ESTUDANTE],
    id_current_phase: 1,
    ...extra,
  };
}

function estudante(id: number, status: ServiceStatus | null, extra: Partial<StudentData> = {}) {
  return usuario(id, { service_status: status, ...extra });
}

const AEE_RESPONSAVEL = { id: 7, full_name: 'Maria AEE' };

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
  it('calls the AEE teacher of a closed service "Atendido por"', () => {
    assert.equal(rotuloDoResponsavel('CLOSED'), 'Atendido por');
  });

  for (const status of ['WAITING', 'IN_SERVICE'] as const) {
    it(`calls the AEE teacher of a ${status} row "Professor(a) do AEE responsável"`, () => {
      assert.equal(rotuloDoResponsavel(status), 'Professor(a) do AEE responsável');
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
    estudante(2, 'IN_SERVICE', { aee_responsible: AEE_RESPONSAVEL }),
    usuario(3, { roles: [PROFISSIONAL_SAUDE], service_status: null }),
    estudante(4, 'WAITING', { queued_at: '2026-10-10T12:00:00.000Z' }),
    estudante(5, 'IN_SERVICE', { aee_responsible: AEE_RESPONSAVEL }),
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

describe('opcoesDoFiltroStatus', () => {
  it('adds "Meus atendimentos" after "Todos" for the AEE teacher', () => {
    assert.deepEqual(opcoesDoFiltroStatus({ sub: 7, roles: [PROFESSOR_AEE] }), [
      { value: 'TODOS', label: 'Todos' },
      { value: 'MEUS', label: 'Meus atendimentos' },
      { value: 'WAITING', label: 'Fila de espera' },
      { value: 'IN_SERVICE', label: 'Em atendimento' },
      { value: 'CLOSED', label: 'Encerrado' },
    ]);
  });

  it('keeps "Meus atendimentos" for a user that accumulates the AEE role', () => {
    const opcoes = opcoesDoFiltroStatus({ sub: 7, roles: [PROFISSIONAL_NAPNE, PROFESSOR_AEE] });

    assert.ok(opcoes.some((opcao) => opcao.value === 'MEUS'));
  });

  for (const [nome, roles] of [
    ['NAPNE', [PROFISSIONAL_NAPNE]],
    ['education professional', [PROFISSIONAL_EDUCACAO]],
    ['health professional', [PROFISSIONAL_SAUDE]],
  ] as const) {
    it(`does not offer "Meus atendimentos" to ${nome}`, () => {
      assert.deepEqual(opcoesDoFiltroStatus({ sub: 7, roles }), OPCOES_FILTRO_STATUS);
    });
  }

  it('does not offer "Meus atendimentos" without a session', () => {
    assert.deepEqual(opcoesDoFiltroStatus(null), OPCOES_FILTRO_STATUS);
    assert.deepEqual(opcoesDoFiltroStatus(undefined), OPCOES_FILTRO_STATUS);
  });
});

describe('filtrarPorStatus com "MEUS"', () => {
  const aee = { sub: 7, roles: [PROFESSOR_AEE] };
  const OUTRA_AEE = { id: 8, full_name: 'Joana AEE' };
  const lista = [
    estudante(1, 'IN_SERVICE', { aee_responsible: AEE_RESPONSAVEL }),
    estudante(2, 'IN_SERVICE', { aee_responsible: OUTRA_AEE }),
    estudante(3, 'CLOSED', { aee_responsible: AEE_RESPONSAVEL }),
    estudante(4, 'WAITING', { aee_responsible: null }),
    estudante(5, 'IN_SERVICE', { aee_responsible: AEE_RESPONSAVEL }),
    usuario(6, { roles: [PROFISSIONAL_SAUDE], service_status: null }),
  ];

  it('keeps only the students being served by the logged AEE teacher', () => {
    assert.deepEqual(
      filtrarPorStatus(lista, 'MEUS', aee).map((u) => u.id),
      [1, 5],
    );
  });

  it('leaves out the ones that teacher already closed', () => {
    assert.ok(!filtrarPorStatus(lista, 'MEUS', aee).some((u) => u.id === 3));
  });

  it('returns nothing for a teacher that serves nobody', () => {
    assert.deepEqual(filtrarPorStatus(lista, 'MEUS', { sub: 99, roles: [PROFESSOR_AEE] }), []);
  });

  it('returns nothing for a user without the AEE role, even with the same id', () => {
    assert.deepEqual(filtrarPorStatus(lista, 'MEUS', { sub: 7, roles: [PROFISSIONAL_NAPNE] }), []);
  });

  it('returns nothing without a session', () => {
    assert.deepEqual(filtrarPorStatus(lista, 'MEUS'), []);
    assert.deepEqual(filtrarPorStatus(lista, 'MEUS', null), []);
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
      usuario(2, { roles: [ADMIN], service_status: null }),
      usuario(3, { roles: [PROFISSIONAL_NAPNE] }),
      usuario(4, { roles: [PROFISSIONAL_EDUCACAO], service_status: null }),
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
  const aee = { sub: 7, roles: [PROFESSOR_AEE] };

  it('lets the AEE teacher take a student of the queue', () => {
    assert.equal(podeAssumirAtendimento(estudante(1, 'WAITING'), aee), true);
  });

  for (const status of ['IN_SERVICE', 'CLOSED', null] as const) {
    it(`does not let the AEE teacher take a row with status ${status}`, () => {
      assert.equal(podeAssumirAtendimento(estudante(1, status), aee), false);
    });
  }

  for (const [nome, roles, esperado] of [
    ['AEE alone', [PROFESSOR_AEE], true],
    ['NAPNE alone', [PROFISSIONAL_NAPNE], false],
    ['NAPNE plus AEE', [PROFISSIONAL_NAPNE, PROFESSOR_AEE], true],
    ['education plus AEE', [PROFISSIONAL_EDUCACAO, PROFESSOR_AEE], true],
    ['administrator', [ADMIN], false],
    ['education professional', [PROFISSIONAL_EDUCACAO], false],
    ['health professional', [PROFISSIONAL_SAUDE], false],
    ['student', [ESTUDANTE], false],
  ] as const) {
    it(`take button with ${nome}: ${esperado}`, () => {
      assert.equal(podeAssumirAtendimento(estudante(1, 'WAITING'), { sub: 7, roles }), esperado);
    });
  }

  it('does not let a session without user take a student of the queue', () => {
    assert.equal(podeAssumirAtendimento(estudante(1, 'WAITING'), null), false);
    assert.equal(podeAssumirAtendimento(estudante(1, 'WAITING'), undefined), false);
  });
});

describe('podeEncerrarAtendimento', () => {
  const aee = { sub: 7, roles: [PROFESSOR_AEE] };
  const emAtendimento = estudante(1, 'IN_SERVICE', { aee_responsible: AEE_RESPONSAVEL });

  it('lets the AEE teacher close the service of a student that is theirs', () => {
    assert.equal(podeEncerrarAtendimento(emAtendimento, aee), true);
  });

  it('does not let the AEE teacher close the service of another teacher', () => {
    assert.equal(podeEncerrarAtendimento(emAtendimento, { sub: 8, roles: [PROFESSOR_AEE] }), false);
  });

  it('does not let the AEE teacher close a student without responsible', () => {
    const semResponsavel = estudante(1, 'IN_SERVICE', { aee_responsible: null });

    assert.equal(podeEncerrarAtendimento(semResponsavel, aee), false);
    assert.equal(podeEncerrarAtendimento(estudante(1, 'IN_SERVICE'), aee), false);
  });

  for (const status of ['WAITING', 'CLOSED', null] as const) {
    it(`does not let the AEE teacher close a row with status ${status}`, () => {
      const linha = estudante(1, status, { aee_responsible: AEE_RESPONSAVEL });

      assert.equal(podeEncerrarAtendimento(linha, aee), false);
    });
  }

  for (const [nome, roles, esperado] of [
    ['AEE alone', [PROFESSOR_AEE], true],
    ['NAPNE alone, even with the same id', [PROFISSIONAL_NAPNE], false],
    ['NAPNE plus AEE', [PROFISSIONAL_NAPNE, PROFESSOR_AEE], true],
    ['education plus AEE', [PROFISSIONAL_EDUCACAO, PROFESSOR_AEE], true],
    ['administrator with the same id', [ADMIN], false],
  ] as const) {
    it(`close button with ${nome}: ${esperado}`, () => {
      assert.equal(podeEncerrarAtendimento(emAtendimento, { sub: 7, roles }), esperado);
    });
  }

  it('does not let a session without user close a service', () => {
    assert.equal(podeEncerrarAtendimento(emAtendimento, null), false);
    assert.equal(podeEncerrarAtendimento(emAtendimento, undefined), false);
  });
});
