import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AeePlan } from '@/interfaces/AeePlan';
import {
  ADMIN,
  ESTUDANTE,
  PROFISSIONAL_EDUCACAO,
  PROFESSOR_AEE,
  PROFISSIONAL_NAPNE,
  PROFISSIONAL_SAUDE,
} from '../consts';
import { lerCaminho } from './formularioPorTabela';
import {
  LIMITES_PAEE,
  SECOES_PAEE,
  erroDoPeriodo,
  formularioDoPlano,
  formularioVazioDoPlano,
  montarCorpoDoPlano,
  periodoLetivoValido,
  podeEditarPaee,
  secoesDoPlanoParaLeitura,
  validarPlanoExistente,
  validarPlanoNovo,
} from './paee';

const TITULOS = [
  'Identificação',
  'Embasamento para o atendimento do AEE',
  'Laudo/diagnóstico',
  'Outros apoios e serviços, internos e externos',
  'Finalidade do AEE',
  'Objetivos',
  'Procedimentos e metodologias para avaliação do desenvolvimento do estudante no AEE',
];

// Copiados do contrato da issue #705 (back/src/aee-plans). Mudar o DTO muda
// este contrato, e aqui o front acompanha, como o estudoDeCaso.test.ts faz.
const CAMINHOS_BOOLEANOS_DA_API = [
  'has_diagnosis',
  'supports.psychology',
  'supports.social_assistance',
  'supports.psychopedagogy',
  'supports.medical',
  'supports.physiotherapy',
  'supports.speech_therapy',
  'supports.equine_therapy',
  'supports.braille_transcription',
  'supports.libras_interpreter',
  'supports.libras_teacher',
  'purpose.curricular_complementation',
  'purpose.curricular_supplementation',
  'purpose.materials_adaptation',
  'purpose.assistive_technology',
  'purpose.systematic_follow_up',
];

const LIMITES_DE_TEXTO_DA_API: ReadonlyArray<readonly [string, number]> = [
  ['identification.subject', 150],
  ['identification.enrolled_subjects', 2000],
  ['basis', 4000],
  ['supports.medical_specialty', 200],
  ['supports.other', 200],
  ['purpose.other', 200],
  ['objectives.general', 2000],
  ['objectives.specific', 2000],
  ['evaluation_procedures', 4000],
];

const CAMINHOS_DE_NUMERO_DA_API: ReadonlyArray<readonly [string, number]> = [
  ['identification.weekly_hours', 40],
];

function planoCompleto(): AeePlan {
  return {
    id: 3,
    semester: '2026.1',
    identification: {
      subject: 'Matemática',
      weekly_hours: 4,
      enrolled_subjects: 'Matemática, Português e Física',
    },
    basis: 'Resolução CONSUP/IFPE nº 315/2025',
    has_diagnosis: true,
    supports: {
      psychology: true,
      social_assistance: false,
      psychopedagogy: true,
      medical: true,
      medical_specialty: 'Neurologia',
      physiotherapy: false,
      speech_therapy: false,
      equine_therapy: false,
      braille_transcription: false,
      libras_interpreter: false,
      libras_teacher: true,
      other: 'Monitoria',
    },
    purpose: {
      curricular_complementation: true,
      curricular_supplementation: false,
      materials_adaptation: true,
      assistive_technology: false,
      systematic_follow_up: true,
      other: '',
    },
    objectives: { general: 'Ampliar a autonomia', specific: 'Leitura de frases\nUso do software' },
    evaluation_procedures: 'Registro semanal das atividades',
    author: { id: 7, full_name: 'Marina Duarte' },
    student: { full_name: 'João Pereira', course: 'Informática' },
    created_at: '2026-03-02T12:00:00.000Z',
    updated_at: '2026-03-09T12:00:00.000Z',
  };
}

// Só as seções: período, autor e datas são da resposta da API, não do corpo.
function sementeDoCorpo(plano: AeePlan) {
  const { identification, basis, has_diagnosis, supports, purpose, objectives, evaluation_procedures } = plano;
  return { identification, basis, has_diagnosis, supports, purpose, objectives, evaluation_procedures };
}

function todosOsCampos() {
  return SECOES_PAEE.flatMap((secao) => secao.grupos).flatMap((grupo) => grupo.campos);
}

describe('formularioVazioDoPlano', () => {
  it('has the period and every field of the PAEE, with blank text and unchecked items', () => {
    assert.deepEqual(formularioVazioDoPlano(), {
      semester: '',
      identification: { subject: '', weekly_hours: '', enrolled_subjects: '' },
      basis: '',
      has_diagnosis: false,
      supports: {
        psychology: false,
        social_assistance: false,
        psychopedagogy: false,
        medical: false,
        medical_specialty: '',
        physiotherapy: false,
        speech_therapy: false,
        equine_therapy: false,
        braille_transcription: false,
        libras_interpreter: false,
        libras_teacher: false,
        other: '',
      },
      purpose: {
        curricular_complementation: false,
        curricular_supplementation: false,
        materials_adaptation: false,
        assistive_technology: false,
        systematic_follow_up: false,
        other: '',
      },
      objectives: { general: '', specific: '' },
      evaluation_procedures: '',
    });
  });

  it('returns a new object on every call', () => {
    const primeiro = formularioVazioDoPlano();
    primeiro.basis = 'alterado';

    assert.equal(formularioVazioDoPlano().basis, '');
  });
});

describe('SECOES_PAEE', () => {
  it('lists the sections of the issue, in order', () => {
    assert.deepEqual(
      SECOES_PAEE.map((secao) => secao.titulo),
      TITULOS,
    );
  });

  it('declares each field path once, and the form has exactly those fields plus the period', () => {
    const caminhos = todosOsCampos().map((item) => item.caminho);

    function folhas(valor: unknown, prefixo = ''): string[] {
      if (typeof valor !== 'object' || valor === null) return [prefixo];
      return Object.entries(valor).flatMap(([chave, filho]) =>
        folhas(filho, prefixo ? `${prefixo}.${chave}` : chave),
      );
    }

    assert.equal(new Set(caminhos).size, caminhos.length);
    assert.deepEqual(
      [...caminhos, 'semester'].sort(),
      folhas(formularioVazioDoPlano()).sort(),
    );
  });

  it('has a checkbox for exactly the boolean fields of the API', () => {
    assert.deepEqual(
      todosOsCampos()
        .filter((item) => item.tipo === 'marcacao')
        .map((item) => item.caminho)
        .sort(),
      [...CAMINHOS_BOOLEANOS_DA_API].sort(),
    );
  });

  it('has a text, with the limit of the API, for exactly the text fields of the API', () => {
    const doFront = todosOsCampos()
      .flatMap((item) =>
        item.tipo === 'texto' || item.tipo === 'textoLongo' ? [[item.caminho, item.max] as const] : [],
      )
      .sort(([a], [b]) => a.localeCompare(b));
    const daApi = [...LIMITES_DE_TEXTO_DA_API].sort(([a], [b]) => a.localeCompare(b));

    assert.deepEqual(doFront, daApi);
  });

  it('has a number, with the limit of the API, for exactly the number fields of the API', () => {
    assert.deepEqual(
      todosOsCampos()
        .filter((item) => item.tipo === 'numero')
        .map((item) => [item.caminho, item.max]),
      CAMINHOS_DE_NUMERO_DA_API,
    );
    assert.equal(LIMITES_PAEE.CARGA_HORARIA_MAXIMA, 40);
  });

  it('has no date field, since the PAEE has none', () => {
    assert.equal(todosOsCampos().filter((item) => item.tipo === 'data').length, 0);
  });

  it('covers every field of the form with the lists of the API', () => {
    assert.equal(
      todosOsCampos().length,
      CAMINHOS_BOOLEANOS_DA_API.length +
        LIMITES_DE_TEXTO_DA_API.length +
        CAMINHOS_DE_NUMERO_DA_API.length,
    );
  });

  it('marks the supports and the purposes as checklists, with the texts that go with them', () => {
    const grupos = SECOES_PAEE.flatMap((secao) => secao.grupos).filter((grupo) => grupo.lista);

    assert.deepEqual(
      grupos.map((grupo) => [grupo.titulo, grupo.campos.filter((c) => c.tipo !== 'marcacao').map((c) => c.caminho)]),
      [
        ['Outros apoios e serviços, internos e externos', ['supports.medical_specialty', 'supports.other']],
        ['Finalidade do AEE', ['purpose.other']],
      ],
    );
  });

  it('labels the supports and the purposes as the issue does', () => {
    const rotulos = (prefixo: string) =>
      todosOsCampos()
        .filter((campo) => campo.caminho.startsWith(prefixo))
        .map((campo) => campo.rotulo);

    assert.deepEqual(rotulos('supports.'), [
      'Psicologia',
      'Assistência social',
      'Psicopedagogia',
      'Área médica',
      'Especialidade',
      'Fisioterapia',
      'Fonoaudiologia',
      'Equoterapia',
      'Transcrição de material em braille/tinta',
      'Tradutor intérprete de Libras',
      'Professor de Libras',
      'Outros',
    ]);
    assert.deepEqual(rotulos('purpose.'), [
      'Complementação curricular (estudantes com deficiência e TEA)',
      'Suplementação curricular (altas habilidades/superdotação)',
      'Adaptação de materiais, serviços e/ou elaboração de recursos para acessibilidade',
      'Indicação e monitoramento do uso de tecnologias assistivas',
      'Acompanhamento sistemático do estudante',
      'Outra',
    ]);
  });
});

describe('formularioDoPlano', () => {
  it('carries the period and turns the weekly hours into form text', () => {
    const form = formularioDoPlano(planoCompleto());

    assert.equal(form.semester, '2026.1');
    assert.equal(form.identification.weekly_hours, '4');
  });

  it('keeps the weekly hours zero and turns missing hours into blank', () => {
    const plano = planoCompleto();
    plano.identification.weekly_hours = 0;
    assert.equal(formularioDoPlano(plano).identification.weekly_hours, '0');

    delete plano.identification.weekly_hours;
    assert.equal(formularioDoPlano(plano).identification.weekly_hours, '');
  });

  it('keeps the checked items and the texts', () => {
    const form = formularioDoPlano(planoCompleto());

    assert.equal(form.has_diagnosis, true);
    assert.equal(form.supports.medical, true);
    assert.equal(form.supports.medical_specialty, 'Neurologia');
    assert.equal(form.purpose.materials_adaptation, true);
    assert.equal(form.purpose.curricular_supplementation, false);
    assert.equal(form.objectives.specific, 'Leitura de frases\nUso do software');
  });
});

describe('montarCorpoDoPlano', () => {
  it('sends the sections of the API from the filled form, without the period', () => {
    const plano = planoCompleto();

    assert.deepEqual(montarCorpoDoPlano(formularioDoPlano(plano)), sementeDoCorpo(plano));
    assert.equal('semester' in montarCorpoDoPlano(formularioDoPlano(plano)), false);
  });

  it('sends a boolean at every checkbox path of the API and a string at every text path', () => {
    const corpo = montarCorpoDoPlano(formularioVazioDoPlano());

    for (const caminho of CAMINHOS_BOOLEANOS_DA_API) {
      assert.equal(typeof lerCaminho(corpo, caminho), 'boolean', caminho);
    }
    for (const [caminho] of LIMITES_DE_TEXTO_DA_API) {
      assert.equal(typeof lerCaminho(corpo, caminho), 'string', caminho);
    }
  });

  it('sends no null, since the API answers 400 to it', () => {
    const corpo = montarCorpoDoPlano(formularioVazioDoPlano());

    assert.equal(JSON.stringify(corpo).includes('null'), false);
  });

  it('leaves the blank weekly hours out of the body, the only field that may be missing', () => {
    const corpo = montarCorpoDoPlano(formularioVazioDoPlano());

    assert.equal('weekly_hours' in corpo.identification, false);
  });

  it('sends the weekly hours as a number, including zero', () => {
    const form = formularioVazioDoPlano();
    form.identification.weekly_hours = ' 0 ';

    assert.equal(montarCorpoDoPlano(form).identification.weekly_hours, 0);
  });

  it('trims the texts and sends blank text as empty text', () => {
    const form = formularioVazioDoPlano();
    form.basis = '\n  Embasamento \n';

    const corpo = montarCorpoDoPlano(form);

    assert.equal(corpo.basis, 'Embasamento');
    assert.equal(corpo.supports.other, '');
  });
});

describe('periodoLetivoValido', () => {
  it('accepts a year and a semester of 1 or 2', () => {
    for (const periodo of ['2026.1', '2026.2', '1999.1', ' 2026.1 ']) {
      assert.equal(periodoLetivoValido(periodo), true, periodo);
    }
  });

  it('refuses anything that is not AAAA.S', () => {
    for (const periodo of ['', '2026', '2026.', '2026.0', '2026.3', '2026.12', '26.1', '2026-1', '2026,1', '2026/1', 'abcd.1', '2026.1.1']) {
      assert.equal(periodoLetivoValido(periodo), false, periodo);
    }
  });
});

describe('erroDoPeriodo', () => {
  it('is empty for a valid period', () => {
    assert.deepEqual(erroDoPeriodo('2026.2'), {});
  });

  it('names the field and the format, keyed by the path of the period', () => {
    for (const periodo of ['', '2026', '2026.3']) {
      assert.deepEqual(erroDoPeriodo(periodo), {
        semester: 'O campo "Período letivo" deve ter o formato AAAA.S, com semestre 1 ou 2 (por exemplo, 2026.1).',
      });
    }
  });
});

describe('validarPlanoExistente', () => {
  it('accepts the empty form and the filled form', () => {
    assert.deepEqual(validarPlanoExistente(formularioVazioDoPlano()), {});
    assert.deepEqual(validarPlanoExistente(formularioDoPlano(planoCompleto())), {});
  });

  it('does not look at the period, which the PAEE keeps', () => {
    assert.deepEqual(validarPlanoExistente({ ...formularioVazioDoPlano(), semester: 'x' }), {});
  });

  it('refuses a text above its limit, naming the field and the limit, and accepts it at the limit', () => {
    const form = formularioVazioDoPlano();
    form.identification.subject = 'a'.repeat(151);
    form.identification.enrolled_subjects = 'a'.repeat(2001);
    form.basis = 'a'.repeat(4001);
    form.supports.medical_specialty = 'a'.repeat(201);
    form.supports.other = 'a'.repeat(201);
    form.purpose.other = 'a'.repeat(201);
    form.objectives.general = 'a'.repeat(2001);
    form.objectives.specific = 'a'.repeat(2001);
    form.evaluation_procedures = 'a'.repeat(4001);

    const erros = validarPlanoExistente(form);

    assert.deepEqual(
      Object.keys(erros).sort(),
      LIMITES_DE_TEXTO_DA_API.map(([caminho]) => caminho).sort(),
    );
    assert.equal(
      erros['identification.subject'],
      'O campo "Disciplina" deve ter no máximo 150 caracteres.',
    );

    const noLimite = formularioVazioDoPlano();
    for (const [caminho, max] of LIMITES_DE_TEXTO_DA_API) {
      const [secao, campo] = caminho.split('.');
      if (campo) (noLimite as unknown as Record<string, Record<string, string>>)[secao][campo] = 'a'.repeat(max);
      else (noLimite as unknown as Record<string, string>)[secao] = 'a'.repeat(max);
    }
    assert.deepEqual(validarPlanoExistente(noLimite), {});
  });

  it('accepts weekly hours from 0 to 40', () => {
    for (const horas of ['0', '1', '20', '40', ' 8 ']) {
      const form = formularioVazioDoPlano();
      form.identification.weekly_hours = horas;

      assert.deepEqual(validarPlanoExistente(form), {}, horas);
    }
  });

  it('refuses weekly hours that are not a whole number from 0 to 40', () => {
    for (const horas of ['41', '-1', '1.5', '1,5', 'abc', '1e1', '10 horas']) {
      const form = formularioVazioDoPlano();
      form.identification.weekly_hours = horas;

      assert.equal(
        validarPlanoExistente(form)['identification.weekly_hours'],
        'O campo "Carga horária semanal do AEE" deve ser um número inteiro entre 0 e 40.',
        horas,
      );
    }
  });
});

describe('validarPlanoNovo', () => {
  it('refuses a missing or malformed period, listing it before the other errors', () => {
    const form = formularioVazioDoPlano();
    form.basis = 'a'.repeat(4001);

    assert.deepEqual(Object.keys(validarPlanoNovo(form)), ['semester', 'basis']);
  });

  it('accepts a valid period with the form otherwise empty', () => {
    assert.deepEqual(validarPlanoNovo({ ...formularioVazioDoPlano(), semester: '2026.1' }), {});
  });
});

describe('podeEditarPaee', () => {
  it('lets only the AEE teacher write, as POST, PATCH and DELETE in the API', () => {
    assert.equal(podeEditarPaee([PROFESSOR_AEE]), true);
    for (const nivel of [ADMIN, ESTUDANTE, PROFISSIONAL_EDUCACAO, PROFISSIONAL_SAUDE, PROFISSIONAL_NAPNE]) {
      assert.equal(podeEditarPaee([nivel]), false, String(nivel));
    }
  });

  it('denies a session without a level', () => {
    assert.equal(podeEditarPaee(undefined), false);
  });
});

describe('secoesDoPlanoParaLeitura', () => {
  function linhasDe(titulo: string, plano = planoCompleto(), curso?: string | null) {
    const secao = secoesDoPlanoParaLeitura(plano, curso).find((item) => item.titulo === titulo);
    assert.ok(secao, `seção ${titulo} não encontrada`);
    return secao.linhas;
  }

  function valorDe(titulo: string, rotulo: string, plano = planoCompleto(), curso?: string | null) {
    const linha = linhasDe(titulo, plano, curso).find((item) => item.label === rotulo);
    assert.ok(linha, `linha ${rotulo} não encontrada`);
    return linha.value;
  }

  it('lists the sections of the issue, in order', () => {
    assert.deepEqual(
      secoesDoPlanoParaLeitura(planoCompleto()).map((secao) => secao.titulo),
      TITULOS,
    );
  });

  it('prints the identification as the issue lists it: course, subject, period, teacher, hours, subjects', () => {
    assert.deepEqual(linhasDe('Identificação', planoCompleto(), 'Informática'), [
      { label: 'Curso', value: 'Informática' },
      { label: 'Disciplina', value: 'Matemática' },
      { label: 'Período letivo', value: '2026.1' },
      { label: 'Professor(a) do AEE', value: 'Marina Duarte' },
      { label: 'Carga horária semanal do AEE', value: '4 horas' },
      { label: 'Disciplinas em que o estudante está matriculado', value: 'Matemática, Português e Física', larga: true },
    ]);
  });

  it('leaves the course row out when the course is unknown, and prints "Não informado" when the student has none', () => {
    const semCurso = linhasDe('Identificação').map((linha) => linha.label);

    assert.equal(semCurso.includes('Curso'), false);
    assert.equal(valorDe('Identificação', 'Curso', planoCompleto(), null), 'Não informado');
  });

  it('prints the singular for one weekly hour', () => {
    const plano = planoCompleto();
    plano.identification.weekly_hours = 1;

    assert.equal(valorDe('Identificação', 'Carga horária semanal do AEE', plano), '1 hora');
  });

  it('prints "Não informado" for blank values, missing hours and a missing author', () => {
    const plano = planoCompleto();
    plano.identification = { subject: '   ', enrolled_subjects: '' };
    plano.author = null;

    assert.equal(valorDe('Identificação', 'Disciplina', plano), 'Não informado');
    assert.equal(valorDe('Identificação', 'Carga horária semanal do AEE', plano), 'Não informado');
    assert.equal(
      valorDe('Identificação', 'Disciplinas em que o estudante está matriculado', plano),
      'Não informado',
    );
    assert.equal(valorDe('Identificação', 'Professor(a) do AEE', plano), 'Não informado');
  });

  it('prints the diagnosis as Sim or Não', () => {
    const plano = planoCompleto();
    assert.equal(valorDe('Laudo/diagnóstico', 'Há laudo/diagnóstico?', plano), 'Sim');

    plano.has_diagnosis = false;
    assert.equal(valorDe('Laudo/diagnóstico', 'Há laudo/diagnóstico?', plano), 'Não');
  });

  it('lists only the checked supports, one per line, with the specialty and the other in their own rows', () => {
    const titulo = 'Outros apoios e serviços, internos e externos';

    assert.equal(valorDe(titulo, titulo), '• Psicologia\n• Psicopedagogia\n• Área médica\n• Professor de Libras');
    assert.equal(valorDe(titulo, `${titulo}: especialidade`), 'Neurologia');
    assert.equal(valorDe(titulo, `${titulo}: outros`), 'Monitoria');
  });

  it('lists only the checked purposes and prints "Nenhuma opção marcada" when there is none', () => {
    const plano = planoCompleto();
    assert.equal(
      valorDe('Finalidade do AEE', 'Finalidade do AEE', plano),
      '• Complementação curricular (estudantes com deficiência e TEA)\n• Adaptação de materiais, serviços e/ou elaboração de recursos para acessibilidade\n• Acompanhamento sistemático do estudante',
    );
    assert.equal(valorDe('Finalidade do AEE', 'Finalidade do AEE: outra', plano), 'Não informado');

    plano.purpose = {
      curricular_complementation: false,
      curricular_supplementation: false,
      materials_adaptation: false,
      assistive_technology: false,
      systematic_follow_up: false,
      other: 'Pesquisa',
    };
    assert.equal(valorDe('Finalidade do AEE', 'Finalidade do AEE', plano), 'Nenhuma opção marcada');
    assert.equal(valorDe('Finalidade do AEE', 'Finalidade do AEE: outra', plano), 'Pesquisa');
  });

  it('prints the long texts under the label of the form', () => {
    assert.equal(
      valorDe('Embasamento para o atendimento do AEE', 'Embasamento para o atendimento do AEE'),
      'Resolução CONSUP/IFPE nº 315/2025',
    );
    assert.equal(valorDe('Objetivos', 'Objetivo geral do AEE'), 'Ampliar a autonomia');
    assert.equal(valorDe('Objetivos', 'Objetivos específicos do AEE'), 'Leitura de frases\nUso do software');
    assert.equal(
      valorDe(TITULOS[6], TITULOS[6]),
      'Registro semanal das atividades',
    );
  });

  it('prints "Não informado" for a blank text', () => {
    const plano = planoCompleto();
    plano.basis = '';

    assert.equal(
      valorDe('Embasamento para o atendimento do AEE', 'Embasamento para o atendimento do AEE', plano),
      'Não informado',
    );
  });
});

describe('podeEditarPaee with several roles', () => {
  it('lets the AEE role write alone or together with another role', () => {
    assert.equal(podeEditarPaee([PROFISSIONAL_NAPNE, PROFESSOR_AEE]), true);
    assert.equal(podeEditarPaee([PROFISSIONAL_EDUCACAO, PROFESSOR_AEE]), true);
  });

  it('gives the NAPNE professional only the read, with or without another non-AEE role', () => {
    assert.equal(podeEditarPaee([PROFISSIONAL_NAPNE]), false);
    assert.equal(podeEditarPaee([PROFISSIONAL_EDUCACAO, PROFISSIONAL_NAPNE]), false);
  });
});
