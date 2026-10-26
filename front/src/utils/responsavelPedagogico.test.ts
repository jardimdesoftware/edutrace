import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  montarCorpoDoResponsavel,
  nomeDoResponsavel,
  podeDefinirResponsavel,
  rascunhoInicial,
  RESPONSAVEL_NOME_MAX,
  rotuloDaOpcao,
  SEM_RESPONSAVEL,
  type RascunhoResponsavel,
} from './responsavelPedagogico';
import {
  ADMIN,
  ESTUDANTE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_NAPNE,
  PROFISSIONAL_SAUDE,
} from '../consts';

function rascunho(extra: Partial<RascunhoResponsavel> = {}): RascunhoResponsavel {
  return { tipo: 'EXTERNAL', servidorId: '', nome: '', telefone: '', cpf: '', ...extra };
}

describe('nomeDoResponsavel', () => {
  it('shows the name of the server linked to the student', () => {
    assert.equal(
      nomeDoResponsavel({
        pedagogical_manager: { id: 7, full_name: 'Maria Educação' },
        external_manager_name: null,
      }),
      'Maria Educação',
    );
  });

  it('shows the name of the external person when there is no server', () => {
    assert.equal(
      nomeDoResponsavel({ pedagogical_manager: null, external_manager_name: 'João Externo' }),
      'João Externo',
    );
  });

  for (const [descricao, estudante] of [
    ['both are null', { pedagogical_manager: null, external_manager_name: null }],
    ['the keys are missing', {}],
    ['the external name is blank', { external_manager_name: '   ' }],
  ] as const) {
    it(`falls back to the unassigned text when ${descricao}`, () => {
      assert.equal(nomeDoResponsavel(estudante), SEM_RESPONSAVEL);
    });
  }

  it('falls back to the unassigned text when there is no record', () => {
    assert.equal(nomeDoResponsavel(null), SEM_RESPONSAVEL);
    assert.equal(nomeDoResponsavel(undefined), SEM_RESPONSAVEL);
  });

  it('keeps the text the screens already show', () => {
    assert.equal(SEM_RESPONSAVEL, 'Responsável não atribuído');
  });
});

describe('podeDefinirResponsavel', () => {
  for (const [nome, nivel, esperado] of [
    ['administrator', ADMIN, true],
    ['NAPNE professional', PROFISSIONAL_NAPNE, true],
    ['education professional', PROFISSIONAL_EDUCACAO, false],
    ['health professional', PROFISSIONAL_SAUDE, false],
    ['student', ESTUDANTE, false],
  ] as const) {
    it(`${esperado ? 'allows' : 'denies'} the ${nome} on a student`, () => {
      assert.equal(
        podeDefinirResponsavel({ id_level: nivel }, { id_level: ESTUDANTE }),
        esperado,
      );
    });
  }

  it('denies a session without user', () => {
    assert.equal(podeDefinirResponsavel(null, { id_level: ESTUDANTE }), false);
    assert.equal(podeDefinirResponsavel(undefined, { id_level: ESTUDANTE }), false);
  });

  it('denies when the record is not a student, which the administrator list also has', () => {
    assert.equal(
      podeDefinirResponsavel({ id_level: ADMIN }, { id_level: PROFISSIONAL_NAPNE }),
      false,
    );
    assert.equal(podeDefinirResponsavel({ id_level: ADMIN }, null), false);
  });
});

describe('rotuloDaOpcao', () => {
  it('names the level of the server, since two servers can have the same name', () => {
    assert.equal(
      rotuloDaOpcao({ id: 1, full_name: 'Ana Souza', id_level: PROFISSIONAL_EDUCACAO, roles: [PROFISSIONAL_EDUCACAO] }),
      'Ana Souza (Profissional da Educação)',
    );
    assert.equal(
      rotuloDaOpcao({ id: 2, full_name: 'Ana Souza', id_level: PROFISSIONAL_NAPNE, roles: [PROFISSIONAL_NAPNE] }),
      'Ana Souza (Profissional NAPNE)',
    );
  });

  it('shows only the name for a level the list does not name', () => {
    assert.equal(rotuloDaOpcao({ id: 3, full_name: 'Ana Souza', id_level: 9, roles: [9] }), 'Ana Souza');
  });
});

describe('rascunhoInicial', () => {
  it('starts on the server type, with nothing chosen, when the student has no manager', () => {
    assert.deepEqual(rascunhoInicial({ pedagogical_manager: null, external_manager_name: null }), {
      tipo: 'SERVER',
      servidorId: '',
      nome: '',
      telefone: '',
      cpf: '',
    });
  });

  it('starts on the current server', () => {
    assert.deepEqual(
      rascunhoInicial({
        pedagogical_manager: { id: 7, full_name: 'Maria Educação' },
        external_manager_name: null,
      }),
      { tipo: 'SERVER', servidorId: '7', nome: '', telefone: '', cpf: '' },
    );
  });

  it('starts on the current external person, without the masked CPF', () => {
    assert.deepEqual(
      rascunhoInicial({
        pedagogical_manager: null,
        external_manager_name: 'João Externo',
        external_manager_phone: '11987654321',
        external_manager_cpf: '***.456.789-**',
      }),
      {
        tipo: 'EXTERNAL',
        servidorId: '',
        nome: 'João Externo',
        telefone: '11987654321',
        cpf: '',
      },
    );
  });

  it('starts with an empty phone when the API does not send it', () => {
    assert.equal(
      rascunhoInicial({ pedagogical_manager: null, external_manager_name: 'João Externo' })
        .telefone,
      '',
    );
  });
});

describe('montarCorpoDoResponsavel', () => {
  describe('servidor', () => {
    it('sends the id of the chosen server as a number', () => {
      assert.deepEqual(montarCorpoDoResponsavel(rascunho({ tipo: 'SERVER', servidorId: '7' })), {
        ok: true,
        data: { kind: 'SERVER', user_id: 7 },
      });
    });

    for (const servidorId of ['', '  ', '0', '-3', '1.5', 'abc']) {
      it(`asks for a server when the id is ${JSON.stringify(servidorId)}`, () => {
        assert.deepEqual(montarCorpoDoResponsavel(rascunho({ tipo: 'SERVER', servidorId })), {
          ok: false,
          error: 'Escolha o servidor responsável.',
        });
      });
    }

    it('ignores what was typed in the external fields', () => {
      assert.deepEqual(
        montarCorpoDoResponsavel(
          rascunho({ tipo: 'SERVER', servidorId: '7', nome: 'João', telefone: '1', cpf: '2' }),
        ),
        { ok: true, data: { kind: 'SERVER', user_id: 7 } },
      );
    });
  });

  describe('externo', () => {
    const valido = { nome: 'João Externo', telefone: '11987654321', cpf: '12345678909' };

    it('sends name, phone and CPF', () => {
      assert.deepEqual(montarCorpoDoResponsavel(rascunho(valido)), {
        ok: true,
        data: {
          kind: 'EXTERNAL',
          name: 'João Externo',
          phone: '11987654321',
          cpf: '12345678909',
        },
      });
    });

    it('trims the name', () => {
      const resultado = montarCorpoDoResponsavel(rascunho({ ...valido, nome: '  João Externo  ' }));
      assert.deepEqual(resultado.ok && resultado.data, {
        kind: 'EXTERNAL',
        name: 'João Externo',
        phone: '11987654321',
        cpf: '12345678909',
      });
    });

    it('removes the punctuation of the phone and of the CPF before sending', () => {
      assert.deepEqual(
        montarCorpoDoResponsavel(
          rascunho({ ...valido, telefone: '(11) 98765-4321', cpf: '123.456.789-09' }),
        ),
        {
          ok: true,
          data: {
            kind: 'EXTERNAL',
            name: 'João Externo',
            phone: '11987654321',
            cpf: '12345678909',
          },
        },
      );
    });

    it('accepts a phone with 10 digits, a landline with area code', () => {
      const resultado = montarCorpoDoResponsavel(rascunho({ ...valido, telefone: '1132654321' }));
      assert.equal(resultado.ok && resultado.data.kind === 'EXTERNAL' && resultado.data.phone, '1132654321');
    });

    for (const nome of ['', '   ']) {
      it(`asks for the name when it is ${JSON.stringify(nome)}`, () => {
        assert.deepEqual(montarCorpoDoResponsavel(rascunho({ ...valido, nome })), {
          ok: false,
          error: 'Informe o nome da pessoa responsável.',
        });
      });
    }

    it('accepts a name with exactly the maximum length', () => {
      const nome = 'a'.repeat(RESPONSAVEL_NOME_MAX);
      assert.equal(montarCorpoDoResponsavel(rascunho({ ...valido, nome })).ok, true);
    });

    it('refuses a name above the maximum length', () => {
      assert.deepEqual(
        montarCorpoDoResponsavel(rascunho({ ...valido, nome: 'a'.repeat(RESPONSAVEL_NOME_MAX + 1) })),
        { ok: false, error: `O nome deve ter no máximo ${RESPONSAVEL_NOME_MAX} caracteres.` },
      );
    });

    it('uses the same maximum as the back', () => {
      assert.equal(RESPONSAVEL_NOME_MAX, 150);
    });

    const ERRO_TELEFONE = 'Informe o telefone com DDD, com 10 ou 11 dígitos.';

    for (const telefone of ['', '123456789', '123456789012', '1198765432a', '+5511987654321', '٣٣٣٣٣٣٣٣٣٣']) {
      it(`refuses the phone ${JSON.stringify(telefone)}`, () => {
        assert.deepEqual(montarCorpoDoResponsavel(rascunho({ ...valido, telefone })), {
          ok: false,
          error: ERRO_TELEFONE,
        });
      });
    }

    const ERRO_CPF = 'Informe o CPF com 11 dígitos.';

    for (const cpf of ['', '1234567890', '123456789012', '123456789O9', '***.456.789-**']) {
      it(`refuses the CPF ${JSON.stringify(cpf)}`, () => {
        assert.deepEqual(montarCorpoDoResponsavel(rascunho({ ...valido, cpf })), {
          ok: false,
          error: ERRO_CPF,
        });
      });
    }

    it('reports the name first, then the phone, then the CPF', () => {
      assert.deepEqual(montarCorpoDoResponsavel(rascunho({ nome: '', telefone: '1', cpf: '1' })), {
        ok: false,
        error: 'Informe o nome da pessoa responsável.',
      });
      assert.deepEqual(montarCorpoDoResponsavel(rascunho({ nome: 'João', telefone: '1', cpf: '1' })), {
        ok: false,
        error: ERRO_TELEFONE,
      });
    });

    it('ignores the server id', () => {
      assert.deepEqual(montarCorpoDoResponsavel(rascunho({ ...valido, servidorId: '7' })), {
        ok: true,
        data: {
          kind: 'EXTERNAL',
          name: 'João Externo',
          phone: '11987654321',
          cpf: '12345678909',
        },
      });
    });
  });

  describe('remover', () => {
    it('sends only the kind, whatever is in the other fields', () => {
      assert.deepEqual(
        montarCorpoDoResponsavel(
          rascunho({ tipo: 'NONE', servidorId: '7', nome: 'João', telefone: '1', cpf: '2' }),
        ),
        { ok: true, data: { kind: 'NONE' } },
      );
    });
  });
});
