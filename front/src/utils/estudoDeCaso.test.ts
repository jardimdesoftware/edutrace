import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CaseStudy } from '@/interfaces/CaseStudy';
import {
  ADMIN,
  ESTUDANTE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_NAPNE,
  PROFISSIONAL_SAUDE,
} from '../consts';
import {
  LIMITES,
  SECOES,
  cursoDoEstudo,
  formatarDataISO,
  formularioDoEstudo,
  formularioVazio,
  lerCaminho,
  montarCorpo,
  podeEditarEstudoDeCaso,
  secoesParaLeitura,
  validarFormulario,
} from './estudoDeCaso';

const TITULOS = [
  'Identificação',
  'Informações gerais',
  'Histórico escolar',
  'Aspectos pedagógicos',
  'Aspectos comportamentais e sociais',
  'Potencialidades e interesses',
  'Barreiras para aprendizagem e participação',
  'Recursos e estratégias',
  'Recomendações para o PEI',
  'Parecer do professor do AEE',
];

// Copiadas de back/test/case-studies/case-study.fixtures.ts (FLAG_PATHS,
// TEXT_LIMITS e DATE_PATHS), onde o contrato do DTO fica fixado. Mudar o DTO
// quebra aquele teste, e aqui o front acompanha.
const CAMINHOS_BOOLEANOS_DA_API = [
  'general_info.has_medical_report',
  'general_info.follow_ups.health',
  'general_info.follow_ups.therapies',
  'pedagogical_aspects.language.verbal',
  'pedagogical_aspects.language.gestures',
  'pedagogical_aspects.language.alternative_communication',
  'pedagogical_aspects.language.frequent_mediation',
  'pedagogical_aspects.reading_writing.recognizes_letters',
  'pedagogical_aspects.reading_writing.recognizes_syllables',
  'pedagogical_aspects.reading_writing.reads_words',
  'pedagogical_aspects.reading_writing.reads_sentences',
  'pedagogical_aspects.reading_writing.spontaneous_writing',
  'pedagogical_aspects.reading_writing.copies_texts',
  'pedagogical_aspects.reading_writing.needs_adaptation',
  'pedagogical_aspects.math.recognizes_numbers',
  'pedagogical_aspects.math.counts',
  'pedagogical_aspects.math.simple_operations',
  'pedagogical_aspects.math.problem_solving',
  'pedagogical_aspects.math.needs_concrete_material',
];

const LIMITES_DE_TEXTO_DA_API: ReadonlyArray<readonly [string, number]> = [
  ['identification.grade', 50],
  ['general_info.diagnosis', 2000],
  ['general_info.follow_ups.other', 200],
  ['school_history.time_at_institution', 200],
  ['school_history.previous_specialized_services', 2000],
  ['school_history.main_difficulties', 2000],
  ['school_history.observed_potentialities', 2000],
  ['pedagogical_aspects.language.notes', 1000],
  ['pedagogical_aspects.reading_writing.notes', 1000],
  ['pedagogical_aspects.math.notes', 1000],
  ['behavioral_social.peer_interaction', 2000],
  ['behavioral_social.teacher_interaction', 2000],
  ['behavioral_social.participation', 2000],
  ['behavioral_social.interfering_behaviors', 2000],
  ['potentialities_interests', 2000],
  ['barriers', 2000],
  ['resources_strategies.accessibility_resources', 2000],
  ['resources_strategies.pedagogical_strategies', 2000],
  ['resources_strategies.curricular_adaptations', 2000],
  ['resources_strategies.adaptation_justification', 2000],
  ['pei_recommendations.priority_objectives', 2000],
  ['pei_recommendations.referrals', 2000],
  ['pei_recommendations.teacher_guidance', 2000],
  ['aee_opinion.opinion', 4000],
];

const CAMINHOS_DE_DATA_DA_API = ['identification.date', 'aee_opinion.date'];

function estudoCompleto(): CaseStudy {
  return {
    identification: { grade: '2º ano', age: 16, date: '2026-10-17' },
    general_info: {
      diagnosis: 'TEA nível 1',
      has_medical_report: true,
      follow_ups: { health: true, therapies: false, other: 'Apoio escolar' },
    },
    school_history: {
      time_at_institution: '2 anos',
      previous_specialized_services: 'AEE no ensino fundamental',
      main_difficulties: 'Leitura de textos longos',
      observed_potentialities: 'Memória visual',
    },
    pedagogical_aspects: {
      language: {
        verbal: true,
        gestures: false,
        alternative_communication: false,
        frequent_mediation: true,
        notes: 'Fala frases curtas',
      },
      reading_writing: {
        recognizes_letters: true,
        recognizes_syllables: true,
        reads_words: true,
        reads_sentences: false,
        spontaneous_writing: false,
        copies_texts: true,
        needs_adaptation: true,
        notes: 'Copia com apoio',
      },
      math: {
        recognizes_numbers: true,
        counts: true,
        simple_operations: false,
        problem_solving: false,
        needs_concrete_material: true,
        notes: 'Usa material dourado',
      },
    },
    behavioral_social: {
      peer_interaction: 'Prefere duplas',
      teacher_interaction: 'Busca apoio quando precisa',
      participation: 'Participa de atividades práticas',
      interfering_behaviors: 'Ansiedade em avaliações',
    },
    potentialities_interests: 'Informática e desenho',
    barriers: 'Ruído na sala',
    resources_strategies: {
      accessibility_resources: 'Fone abafador',
      pedagogical_strategies: 'Instruções divididas em etapas',
      curricular_adaptations: 'Provas com tempo estendido',
      adaptation_justification: 'Processamento mais lento',
    },
    pei_recommendations: {
      priority_objectives: 'Ampliar a leitura de frases',
      referrals: 'Fonoaudiologia',
      teacher_guidance: 'Antecipar a rotina da aula',
    },
    aee_opinion: { opinion: 'Segue com adaptação curricular.', date: '2026-10-20' },
    author: { id: 7, full_name: 'Marina Duarte' },
    student: { full_name: 'João Pereira', course: 'Informática' },
    created_at: '2026-10-17T12:00:00.000Z',
    updated_at: '2026-10-18T12:00:00.000Z',
  };
}

// Só as seções: autor e datas são da resposta da API, não do corpo.
function sementeDoCorpo(estudo: CaseStudy) {
  return Object.fromEntries(
    Object.keys(formularioVazio()).map((secao) => [secao, estudo[secao as keyof CaseStudy]]),
  );
}

function todosOsCampos() {
  return SECOES.flatMap((secao) => secao.grupos).flatMap((grupo) => grupo.campos);
}

describe('formularioVazio', () => {
  it('has every field of the case study, with blank text and unchecked items', () => {
    assert.deepEqual(formularioVazio(), {
      identification: { grade: '', age: '', date: '' },
      general_info: {
        diagnosis: '',
        has_medical_report: false,
        follow_ups: { health: false, therapies: false, other: '' },
      },
      school_history: {
        time_at_institution: '',
        previous_specialized_services: '',
        main_difficulties: '',
        observed_potentialities: '',
      },
      pedagogical_aspects: {
        language: {
          verbal: false,
          gestures: false,
          alternative_communication: false,
          frequent_mediation: false,
          notes: '',
        },
        reading_writing: {
          recognizes_letters: false,
          recognizes_syllables: false,
          reads_words: false,
          reads_sentences: false,
          spontaneous_writing: false,
          copies_texts: false,
          needs_adaptation: false,
          notes: '',
        },
        math: {
          recognizes_numbers: false,
          counts: false,
          simple_operations: false,
          problem_solving: false,
          needs_concrete_material: false,
          notes: '',
        },
      },
      behavioral_social: {
        peer_interaction: '',
        teacher_interaction: '',
        participation: '',
        interfering_behaviors: '',
      },
      potentialities_interests: '',
      barriers: '',
      resources_strategies: {
        accessibility_resources: '',
        pedagogical_strategies: '',
        curricular_adaptations: '',
        adaptation_justification: '',
      },
      pei_recommendations: { priority_objectives: '', referrals: '', teacher_guidance: '' },
      aee_opinion: { opinion: '', date: '' },
    });
  });

  it('returns a new object on every call', () => {
    const primeiro = formularioVazio();
    primeiro.identification.grade = 'alterado';

    assert.equal(formularioVazio().identification.grade, '');
  });
});

describe('SECOES', () => {
  it('lists the sections of the issue, in order', () => {
    assert.deepEqual(
      SECOES.map((secao) => secao.titulo),
      TITULOS,
    );
  });

  it('declares each field path once, and the form has exactly those fields', () => {
    const caminhos = todosOsCampos().map((item) => item.caminho);
    const unicos = new Set(caminhos);

    function folhas(valor: unknown, prefixo = ''): string[] {
      if (typeof valor !== 'object' || valor === null) return [prefixo];
      return Object.entries(valor).flatMap(([chave, filho]) =>
        folhas(filho, prefixo ? `${prefixo}.${chave}` : chave),
      );
    }

    assert.equal(unicos.size, caminhos.length);
    assert.deepEqual([...unicos].sort(), folhas(formularioVazio()).sort());
  });

  it('gives every text field a positive limit', () => {
    for (const item of todosOsCampos()) {
      if (item.tipo === 'texto' || item.tipo === 'textoLongo') {
        assert.ok(item.max > 0, item.caminho);
      }
    }
  });

  it('uses the age limit of the API', () => {
    assert.equal(LIMITES.IDADE_MAXIMA, 120);
    assert.deepEqual(
      todosOsCampos()
        .filter((item) => item.tipo === 'numero')
        .map((item) => [item.caminho, item.max]),
      [['identification.age', 120]],
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

  it('has a date for exactly the date fields of the API', () => {
    assert.deepEqual(
      todosOsCampos()
        .filter((item) => item.tipo === 'data')
        .map((item) => item.caminho)
        .sort(),
      [...CAMINHOS_DE_DATA_DA_API].sort(),
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

  it('covers every field of the form with the lists of the API', () => {
    assert.equal(
      todosOsCampos().length,
      CAMINHOS_BOOLEANOS_DA_API.length +
        LIMITES_DE_TEXTO_DA_API.length +
        CAMINHOS_DE_DATA_DA_API.length +
        1,
    );
  });

  it('marks the pedagogical groups as checklists, with the notes as the only text', () => {
    const pedagogicos = SECOES.find((secao) => secao.titulo === 'Aspectos pedagógicos');

    assert.deepEqual(
      pedagogicos?.grupos.map((grupo) => [grupo.titulo, grupo.lista]),
      [
        ['Linguagem e comunicação', true],
        ['Leitura e escrita', true],
        ['Matemática', true],
      ],
    );
  });
});

describe('formularioDoEstudo', () => {
  it('turns the number and the dates into form text', () => {
    const form = formularioDoEstudo(estudoCompleto());

    assert.equal(form.identification.age, '16');
    assert.equal(form.identification.date, '2026-10-17');
    assert.equal(form.aee_opinion.date, '2026-10-20');
  });

  it('keeps only the day of a date that comes with time', () => {
    const estudo = estudoCompleto();
    estudo.identification.date = '2026-10-17T00:00:00.000Z';

    assert.equal(formularioDoEstudo(estudo).identification.date, '2026-10-17');
  });

  it('turns a missing number, date or text into blank', () => {
    const estudo = estudoCompleto();
    estudo.identification.age = null;
    estudo.identification.date = null;
    estudo.aee_opinion.date = undefined;
    (estudo.general_info as { diagnosis: string | null }).diagnosis = null;

    const form = formularioDoEstudo(estudo);

    assert.equal(form.identification.age, '');
    assert.equal(form.identification.date, '');
    assert.equal(form.aee_opinion.date, '');
    assert.equal(form.general_info.diagnosis, '');
  });

  it('keeps the age zero', () => {
    const estudo = estudoCompleto();
    estudo.identification.age = 0;

    assert.equal(formularioDoEstudo(estudo).identification.age, '0');
  });

  it('keeps the checked items', () => {
    const form = formularioDoEstudo(estudoCompleto());

    assert.equal(form.general_info.has_medical_report, true);
    assert.equal(form.pedagogical_aspects.language.verbal, true);
    assert.equal(form.pedagogical_aspects.language.gestures, false);
  });
});

describe('montarCorpo', () => {
  it('sends the sections of the API from the filled form', () => {
    const estudo = estudoCompleto();

    assert.deepEqual(montarCorpo(formularioDoEstudo(estudo)), sementeDoCorpo(estudo));
  });

  it('sends a boolean at every checkbox path of the API and a string at every text path', () => {
    const corpo = montarCorpo(formularioVazio());

    for (const caminho of CAMINHOS_BOOLEANOS_DA_API) {
      assert.equal(typeof lerCaminho(corpo, caminho), 'boolean', caminho);
    }
    for (const [caminho] of LIMITES_DE_TEXTO_DA_API) {
      assert.equal(typeof lerCaminho(corpo, caminho), 'string', caminho);
    }
  });

  it('sends the health and therapy follow-ups as the checkboxes they are', () => {
    const corpo = montarCorpo(formularioDoEstudo(estudoCompleto()));

    assert.equal(corpo.general_info.follow_ups.health, true);
    assert.equal(corpo.general_info.follow_ups.therapies, false);
  });

  it('trims the texts', () => {
    const form = formularioVazio();
    form.identification.grade = '  2º ano  ';
    form.barriers = '\n  Ruído na sala \n';

    const corpo = montarCorpo(form);

    assert.equal(corpo.identification.grade, '2º ano');
    assert.equal(corpo.barriers, 'Ruído na sala');
  });

  it('leaves the blank age and dates out of the body', () => {
    const corpo = montarCorpo(formularioVazio());

    assert.equal('age' in corpo.identification, false);
    assert.equal('date' in corpo.identification, false);
    assert.equal('date' in corpo.aee_opinion, false);
  });

  it('sends the age as a number, including zero', () => {
    const form = formularioVazio();
    form.identification.age = ' 0 ';

    assert.equal(montarCorpo(form).identification.age, 0);
  });

  it('sends blank text as empty text and unchecked items as false', () => {
    const corpo = montarCorpo(formularioVazio());

    assert.equal(corpo.general_info.diagnosis, '');
    assert.equal(corpo.general_info.has_medical_report, false);
    assert.equal(corpo.pedagogical_aspects.math.counts, false);
  });

  it('does not change the form', () => {
    const form = formularioVazio();
    form.barriers = '  texto  ';

    montarCorpo(form);

    assert.equal(form.barriers, '  texto  ');
  });
});

describe('validarFormulario', () => {
  it('accepts the empty form and the filled form', () => {
    assert.deepEqual(validarFormulario(formularioVazio()), {});
    assert.deepEqual(validarFormulario(formularioDoEstudo(estudoCompleto())), {});
  });

  it('refuses a text above its limit, naming the field and the limit', () => {
    const form = formularioVazio();
    form.identification.grade = 'a'.repeat(51);
    form.pedagogical_aspects.math.notes = 'a'.repeat(1001);
    form.aee_opinion.opinion = 'a'.repeat(4001);
    form.general_info.follow_ups.other = 'a'.repeat(201);
    form.school_history.time_at_institution = 'a'.repeat(201);
    form.barriers = 'a'.repeat(2001);

    const erros = validarFormulario(form);

    assert.deepEqual(Object.keys(erros).sort(), [
      'aee_opinion.opinion',
      'barriers',
      'general_info.follow_ups.other',
      'identification.grade',
      'pedagogical_aspects.math.notes',
      'school_history.time_at_institution',
    ]);
    assert.equal(erros['identification.grade'], 'O campo "Ano/série" deve ter no máximo 50 caracteres.');
    assert.match(erros['aee_opinion.opinion'], /4000 caracteres/);
  });

  it('accepts a text at its limit', () => {
    const form = formularioVazio();
    form.identification.grade = 'a'.repeat(50);
    form.aee_opinion.opinion = 'a'.repeat(4000);

    assert.deepEqual(validarFormulario(form), {});
  });

  it('counts the limit after trimming', () => {
    const form = formularioVazio();
    form.identification.grade = `  ${'a'.repeat(50)}  `;

    assert.deepEqual(validarFormulario(form), {});
  });

  it('accepts ages from 0 to 120', () => {
    for (const idade of ['0', '1', '16', '120', ' 17 ']) {
      const form = formularioVazio();
      form.identification.age = idade;

      assert.deepEqual(validarFormulario(form), {}, idade);
    }
  });

  it('refuses an age that is not a whole number from 0 to 120', () => {
    for (const idade of ['121', '-1', '1.5', '1,5', 'abc', '1e2', '10 anos']) {
      const form = formularioVazio();
      form.identification.age = idade;

      assert.equal(
        validarFormulario(form)['identification.age'],
        'O campo "Idade" deve ser um número inteiro entre 0 e 120.',
        idade,
      );
    }
  });

  it('refuses a date that does not exist', () => {
    for (const data of ['2026-02-30', '2026-13-01', '17/10/2026', '2026-1-1', 'ontem']) {
      const form = formularioVazio();
      form.identification.date = data;
      form.aee_opinion.date = data;

      const erros = validarFormulario(form);

      assert.equal(erros['identification.date'], 'O campo "Data" deve ser uma data válida.', data);
      assert.equal(erros['aee_opinion.date'], 'O campo "Data do parecer" deve ser uma data válida.', data);
    }
  });

  it('accepts a leap day and a blank date', () => {
    const form = formularioVazio();
    form.identification.date = '2028-02-29';

    assert.deepEqual(validarFormulario(form), {});
  });
});

describe('podeEditarEstudoDeCaso', () => {
  it('lets only the NAPNE professional write, as POST, PATCH and DELETE in the API', () => {
    assert.equal(podeEditarEstudoDeCaso([PROFISSIONAL_NAPNE]), true);
    for (const nivel of [ADMIN, ESTUDANTE, PROFISSIONAL_EDUCACAO, PROFISSIONAL_SAUDE]) {
      assert.equal(podeEditarEstudoDeCaso([nivel]), false, String(nivel));
    }
  });

  it('denies a session without a level', () => {
    assert.equal(podeEditarEstudoDeCaso(undefined), false);
  });
});

describe('formatarDataISO', () => {
  it('prints the day without moving it by the time zone', () => {
    assert.equal(formatarDataISO('2026-10-17'), '17/10/2026');
    assert.equal(formatarDataISO('2026-10-17T00:00:00.000Z'), '17/10/2026');
  });

  it('prints nothing for a missing or invalid date', () => {
    assert.equal(formatarDataISO(null), '');
    assert.equal(formatarDataISO(undefined), '');
    assert.equal(formatarDataISO(''), '');
    assert.equal(formatarDataISO('amanhã'), '');
  });
});

describe('cursoDoEstudo', () => {
  it('uses the course the case study came with, which is all a student reading their own study has', () => {
    assert.equal(cursoDoEstudo(estudoCompleto(), null), 'Informática');
  });

  it('prefers the course of the loaded case study over the one of the registration', () => {
    assert.equal(cursoDoEstudo(estudoCompleto(), { course: 'Edificações' }), 'Informática');
  });

  it('keeps null when the loaded case study says the student has no course', () => {
    const estudo = estudoCompleto();
    estudo.student = { full_name: 'João Pereira', course: null };

    assert.equal(cursoDoEstudo(estudo, { course: 'Edificações' }), null);
  });

  it('uses the course of the registration when there is no case study yet', () => {
    assert.equal(cursoDoEstudo(null, { course: 'Edificações' }), 'Edificações');
    assert.equal(cursoDoEstudo(null, { course: null }), null);
    assert.equal(cursoDoEstudo(null, {}), null);
  });

  it('is unknown without a case study and without a registration', () => {
    assert.equal(cursoDoEstudo(null, null), undefined);
  });

  it('falls back to the registration when the API sends the study without the student', () => {
    const estudo = estudoCompleto() as Partial<CaseStudy>;
    delete estudo.student;

    assert.equal(cursoDoEstudo(estudo as CaseStudy, { course: 'Edificações' }), 'Edificações');
  });
});

describe('secoesParaLeitura', () => {
  function linhasDe(titulo: string, estudo = estudoCompleto(), curso?: string | null) {
    const secao = secoesParaLeitura(estudo, curso).find((item) => item.titulo === titulo);
    assert.ok(secao, `seção ${titulo} não encontrada`);
    return secao.linhas;
  }

  function valorDe(titulo: string, rotulo: string, estudo = estudoCompleto(), curso?: string | null) {
    const linha = linhasDe(titulo, estudo, curso).find((item) => item.label === rotulo);
    assert.ok(linha, `linha ${rotulo} não encontrada`);
    return linha.value;
  }

  it('lists the sections of the issue, in order', () => {
    assert.deepEqual(
      secoesParaLeitura(estudoCompleto()).map((secao) => secao.titulo),
      TITULOS,
    );
  });

  it('prints the identification with the registration course and the author as the AEE teacher', () => {
    assert.deepEqual(linhasDe('Identificação', estudoCompleto(), 'Informática'), [
      { label: 'Curso', value: 'Informática' },
      { label: 'Ano/série', value: '2º ano' },
      { label: 'Idade', value: '16 anos' },
      { label: 'Professor(a) do AEE', value: 'Marina Duarte' },
      { label: 'Data', value: '17/10/2026' },
    ]);
  });

  it('leaves the course row out when the course is unknown, and prints "Não informado" when the registration has none', () => {
    const semCurso = linhasDe('Identificação').map((linha) => linha.label);

    assert.deepEqual(semCurso, ['Ano/série', 'Idade', 'Professor(a) do AEE', 'Data']);
    assert.equal(valorDe('Identificação', 'Curso', estudoCompleto(), null), 'Não informado');
  });

  it('keeps every field of the identification, with the course first and the AEE teacher after the age', () => {
    const identificacao = SECOES[0].grupos[0].campos;
    const turno: (typeof identificacao)[number] = {
      tipo: 'texto',
      caminho: 'identification.shift',
      rotulo: 'Turno',
      max: LIMITES.CURTO,
    };
    const idade = identificacao.findIndex((item) => item.caminho === 'identification.age');
    const estudo = estudoCompleto();
    (estudo.identification as Record<string, unknown>).shift = 'Manhã';

    identificacao.splice(idade, 0, turno);
    try {
      assert.deepEqual(
        linhasDe('Identificação', estudo, 'Informática').map((linha) => linha.label),
        ['Curso', 'Ano/série', 'Turno', 'Idade', 'Professor(a) do AEE', 'Data'],
      );
      assert.equal(valorDe('Identificação', 'Turno', estudo), 'Manhã');
    } finally {
      identificacao.splice(idade, 1);
    }
  });

  it('prints the singular for one year of age', () => {
    const estudo = estudoCompleto();
    estudo.identification.age = 1;

    assert.equal(valorDe('Identificação', 'Idade', estudo), '1 ano');
  });

  it('prints "Não informado" for blank values, a missing author and a missing age', () => {
    const estudo = estudoCompleto();
    estudo.identification = { grade: '   ', age: null, date: null };
    estudo.author = null;

    assert.equal(valorDe('Identificação', 'Ano/série', estudo), 'Não informado');
    assert.equal(valorDe('Identificação', 'Idade', estudo), 'Não informado');
    assert.equal(valorDe('Identificação', 'Professor(a) do AEE', estudo), 'Não informado');
    assert.equal(valorDe('Identificação', 'Data', estudo), 'Não informado');
  });

  it('prints the medical report as Sim or Não', () => {
    const estudo = estudoCompleto();

    assert.equal(valorDe('Informações gerais', 'Laudo médico apresentado', estudo), 'Sim');

    estudo.general_info.has_medical_report = false;
    assert.equal(valorDe('Informações gerais', 'Laudo médico apresentado', estudo), 'Não');
  });

  it('prints the health and therapy follow-ups as Sim or Não', () => {
    assert.equal(valorDe('Informações gerais', 'Acompanhamento de saúde'), 'Sim');
    assert.equal(valorDe('Informações gerais', 'Acompanhamento com terapias'), 'Não');
  });

  it('lists only the checked items of a checklist, one per line, with the notes in their own row', () => {
    assert.equal(
      valorDe('Aspectos pedagógicos', 'Linguagem e comunicação'),
      '• Comunica-se verbalmente\n• Necessita de mediação frequente',
    );
    assert.equal(
      valorDe('Aspectos pedagógicos', 'Linguagem e comunicação: observações'),
      'Fala frases curtas',
    );
    assert.equal(
      valorDe('Aspectos pedagógicos', 'Leitura e escrita'),
      '• Reconhece letras\n• Reconhece sílabas\n• Lê palavras\n• Copia textos\n• Necessita de adaptação',
    );
    assert.equal(
      valorDe('Aspectos pedagógicos', 'Matemática'),
      '• Reconhece números\n• Realiza contagem\n• Necessita de material concreto',
    );
  });

  it('prints "Nenhuma opção marcada" for a checklist without items', () => {
    const estudo = estudoCompleto();
    estudo.pedagogical_aspects.math = {
      recognizes_numbers: false,
      counts: false,
      simple_operations: false,
      problem_solving: false,
      needs_concrete_material: false,
      notes: '',
    };

    assert.equal(valorDe('Aspectos pedagógicos', 'Matemática', estudo), 'Nenhuma opção marcada');
    assert.equal(
      valorDe('Aspectos pedagógicos', 'Matemática: observações', estudo),
      'Não informado',
    );
  });

  it('prints each text under the label of the form', () => {
    assert.equal(valorDe('Informações gerais', 'Diagnóstico'), 'TEA nível 1');
    assert.equal(
      valorDe('Histórico escolar', 'Tempo de permanência na instituição'),
      '2 anos',
    );
    assert.equal(valorDe('Recursos e estratégias', 'Recursos de acessibilidade'), 'Fone abafador');
    assert.equal(valorDe('Recomendações para o PEI', 'Encaminhamentos'), 'Fonoaudiologia');
    assert.equal(valorDe('Parecer do professor do AEE', 'Parecer'), 'Segue com adaptação curricular.');
    assert.equal(valorDe('Parecer do professor do AEE', 'Data do parecer'), '20/10/2026');
  });

  it('prints "Não informado" for a blank text', () => {
    const estudo = estudoCompleto();
    estudo.general_info.diagnosis = '';

    assert.equal(valorDe('Informações gerais', 'Diagnóstico', estudo), 'Não informado');
  });
});

describe('podeEditarEstudoDeCaso with several roles', () => {
  it('keeps the write with the NAPNE role, alone or together with the AEE role', () => {
    assert.equal(podeEditarEstudoDeCaso([PROFISSIONAL_NAPNE, 6]), true);
    assert.equal(podeEditarEstudoDeCaso([PROFISSIONAL_EDUCACAO, PROFISSIONAL_NAPNE]), true);
  });

  it('gives the AEE teacher alone only the read, since the write changes owner in a later issue', () => {
    assert.equal(podeEditarEstudoDeCaso([6]), false);
    assert.equal(podeEditarEstudoDeCaso([PROFISSIONAL_EDUCACAO, 6]), false);
  });
});
