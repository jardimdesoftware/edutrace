import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ReportsData } from '@/interfaces/ReportsData';
import { buildReportSections, relatorioVazio, reportFileName } from './reportSections';

type Screening = NonNullable<ReportsData['screening']>;
type PeiEntriesReport = NonNullable<ReportsData['peiEntries']>;
type CaseStudyReport = NonNullable<ReportsData['caseStudy']>;
type AeePlansReport = NonNullable<ReportsData['aeePlans']>;

const screening = { report: 'Laudo' } as Screening;

// O relatório traz o semestre, a disciplina, os campos de conteúdo, os quatro do
// parecer semestral e só o nome do professor autor.
const peiEntries: PeiEntriesReport = [
  {
    semester: '2026.2',
    subject: 'Matemática',
    adapted_objectives: 'Ampliar a autonomia nas operações',
    prioritized_contents: 'Funções e geometria',
    syllabus_adaptations: [
      { syllabus_content: 'Funções do 1º grau', adaptation: 'Usar material concreto' },
      { syllabus_content: 'Geometria plana', adaptation: '' },
    ],
    adapted_methodologies: 'Aulas com recursos visuais',
    adapted_assessments: 'Prova com tempo ampliado',
    adapted_resources: 'Calculadora e ábaco',
    general_notes: '',
    semester_progress: 'Passou a resolver as operações sozinho',
    semester_difficulties: 'Perde o foco em provas longas',
    next_semester_notes: 'Manter o tempo ampliado nas provas',
    individual_sessions: 'Terças, 14h, sala 3, convocado pela coordenação',
    author: { full_name: 'Professora Ana' },
  },
  {
    semester: '2026.1',
    subject: 'Português',
    adapted_objectives: 'Leitura de textos curtos',
    prioritized_contents: '',
    syllabus_adaptations: [],
    adapted_methodologies: '',
    adapted_assessments: '',
    adapted_resources: '',
    general_notes: 'Prefere atividades em dupla',
    semester_progress: '',
    semester_difficulties: '  ',
    next_semester_notes: '',
    individual_sessions: '',
    author: null,
  },
];
const caseStudy = {
  identification: { grade: '2º ano', age: 16, date: '2026-10-17' },
  pedagogical_aspects: { language: { verbal: true, frequent_mediation: true, notes: 'Frases curtas' } },
  barriers: 'Ruído na sala',
  author: { id: 7, full_name: 'Marina Duarte' },
  student: { course: 'Informática' },
} as unknown as CaseStudyReport;

// O relatório traz o período, as seções, só o nome do autor e só o curso do
// estudante.
const aeePlans = [
  {
    semester: '2026.2',
    identification: { subject: 'Matemática', weekly_hours: 4, enrolled_subjects: 'Matemática e Física' },
    basis: 'Embasamento do segundo semestre',
    has_diagnosis: true,
    supports: { psychology: true, medical: true, medical_specialty: 'Neurologia', other: 'Monitoria' },
    purpose: { systematic_follow_up: true, other: '' },
    objectives: { general: 'Ampliar a autonomia', specific: '' },
    evaluation_procedures: 'Registro semanal',
    author: { full_name: 'Marina Duarte' },
    student: { course: 'Informática' },
  },
  {
    semester: '2026.1',
    identification: { subject: 'Português', enrolled_subjects: '' },
    basis: 'Embasamento do primeiro semestre',
    has_diagnosis: false,
    supports: {},
    purpose: {},
    objectives: {},
    evaluation_procedures: '',
    author: null,
    student: { course: 'Informática' },
  },
] as unknown as AeePlansReport;

const TITULO_PEI = 'PEI';
const TITULOS_PEI = ['PEI - 2026.2 - Matemática', 'PEI - 2026.1 - Português'];
const TITULOS_ESTUDO_DE_CASO = [
  'Estudo de Caso - Identificação',
  'Estudo de Caso - Informações gerais',
  'Estudo de Caso - Histórico escolar',
  'Estudo de Caso - Aspectos pedagógicos',
  'Estudo de Caso - Aspectos comportamentais e sociais',
  'Estudo de Caso - Potencialidades e interesses',
  'Estudo de Caso - Barreiras para aprendizagem e participação',
  'Estudo de Caso - Recursos e estratégias',
  'Estudo de Caso - Recomendações para o PEI',
  'Estudo de Caso - Parecer do professor do AEE',
];

function rowsOf(report: ReportsData, title: string) {
  const section = buildReportSections(report).find((s) => s.title === title);
  assert.ok(section, `section ${title} not found`);
  return section.rows;
}

function valueOf(report: ReportsData, title: string, label: string) {
  const row = rowsOf(report, title)?.find((r) => r.label === label);
  assert.ok(row, `row ${label} not found`);
  return row.value;
}

describe('relatorioVazio', () => {
  it('is empty when the student has neither screening, PEI, case study nor PAEE', () => {
    assert.equal(relatorioVazio({ screening: null }), true);
    assert.equal(relatorioVazio({ screening: null, caseStudy: null }), true);
  });

  it('is not empty with only the case study', () => {
    assert.equal(relatorioVazio({ screening: null, caseStudy }), false);
  });

  it('is not empty with only the PAEE', () => {
    assert.equal(relatorioVazio({ screening: null, aeePlans }), false);
  });

  it('is empty when the API sends an empty PAEE list', () => {
    assert.equal(relatorioVazio({ screening: null, aeePlans: [] }), true);
  });

  it('is not empty with only the screening', () => {
    assert.equal(relatorioVazio({ screening }), false);
  });

  it('is not empty with only the PEI', () => {
    assert.equal(relatorioVazio({ screening: null, peiEntries }), false);
  });

  it('is empty when the API sends an empty PEI list', () => {
    assert.equal(relatorioVazio({ screening: null, peiEntries: [] }), true);
  });
});

describe('buildReportSections', () => {
  it('lists the screening, the PEI, the case study and the PAEE, in this order and without the anamnesis', () => {
    const titles = buildReportSections({ screening, peiEntries, caseStudy, aeePlans }).map(
      (s) => s.title,
    );

    assert.deepEqual(titles, [
      'Triagem',
      ...TITULOS_PEI,
      ...TITULOS_ESTUDO_DE_CASO,
      'PAEE - 2026.2',
      'PAEE - 2026.1',
    ]);
  });

  it('marks a missing case study with a single section without rows, also when the API does not send it', () => {
    for (const data of [{ caseStudy: null }, {}]) {
      const sections = buildReportSections({ screening, peiEntries, ...data });
      const estudo = sections.find((s) => s.title === 'Estudo de Caso');

      assert.ok(estudo);
      assert.equal(estudo.rows, null);
      assert.deepEqual(
        sections.map((s) => s.title),
        ['Triagem', ...TITULOS_PEI, 'Estudo de Caso', 'PAEE'],
      );
    }
  });

  it('marks a missing PAEE with a single section without rows, also when the list is empty or the API does not send it', () => {
    for (const data of [{ aeePlans: [] }, {}]) {
      const sections = buildReportSections({ screening, peiEntries, caseStudy, ...data });
      const last = sections[sections.length - 1];

      assert.equal(last.title, 'PAEE');
      assert.equal(last.rows, null);
      assert.equal(sections.length, 1 + TITULOS_PEI.length + TITULOS_ESTUDO_DE_CASO.length + 1);
    }
  });

  it('marks a missing PEI with a single section without rows, also when the list is empty or the API does not send it', () => {
    for (const data of [{ peiEntries: [] }, {}]) {
      const sections = buildReportSections({ screening, caseStudy, aeePlans, ...data });

      assert.deepEqual(
        sections.map((s) => s.title).slice(0, 2),
        ['Triagem', TITULO_PEI],
      );
      assert.equal(sections[1].rows, null);
      assert.equal(sections.length, 2 + TITULOS_ESTUDO_DE_CASO.length + 2);
    }
  });

  it('prints one section per PEI entry, titled with the semester and the subject, in the order of the API', () => {
    const titles = buildReportSections({ screening: null, peiEntries }).map((s) => s.title);

    assert.deepEqual(titles.slice(1, 3), TITULOS_PEI);
    assert.deepEqual(
      buildReportSections({ screening: null, peiEntries: [...peiEntries].reverse() })
        .map((s) => s.title)
        .slice(1, 3),
      [...TITULOS_PEI].reverse(),
    );
  });

  it('prints the identification of a PEI entry first, with the semester, the subject and the teacher', () => {
    const report = { screening: null, peiEntries };

    assert.deepEqual(rowsOf(report, TITULOS_PEI[0])?.slice(0, 3), [
      { label: 'Semestre', value: '2026.2' },
      { label: 'Disciplina', value: 'Matemática' },
      { label: 'Professor(a)', value: 'Professora Ana' },
    ]);
  });

  it('prints the texts of a PEI entry with the labels of the screen, in the order of the screen', () => {
    const report = { screening: null, peiEntries };

    assert.deepEqual(
      rowsOf(report, TITULOS_PEI[0])?.map((row) => row.label),
      [
        'Semestre',
        'Disciplina',
        'Professor(a)',
        'Objetivos adaptados',
        'Conteúdos priorizados no semestre',
        'Conteúdo previsto na ementa (1)',
        'Adequação (1)',
        'Conteúdo previsto na ementa (2)',
        'Adequação (2)',
        'Metodologias adaptadas',
        'Atividades avaliativas adaptadas',
        'Recursos adaptados',
        'Observações gerais',
      ],
    );
    assert.equal(valueOf(report, TITULOS_PEI[0], 'Objetivos adaptados'), 'Ampliar a autonomia nas operações');
    assert.equal(valueOf(report, TITULOS_PEI[0], 'Atividades avaliativas adaptadas'), 'Prova com tempo ampliado');
    assert.equal(valueOf(report, TITULOS_PEI[0], 'Observações gerais'), 'Não informado');
  });

  it('prints the planned content and the adaptation of each pair of a PEI entry', () => {
    const report = { screening: null, peiEntries };
    const titulo = TITULOS_PEI[0];

    assert.equal(valueOf(report, titulo, 'Conteúdo previsto na ementa (1)'), 'Funções do 1º grau');
    assert.equal(valueOf(report, titulo, 'Adequação (1)'), 'Usar material concreto');
    assert.equal(valueOf(report, titulo, 'Conteúdo previsto na ementa (2)'), 'Geometria plana');
    assert.equal(valueOf(report, titulo, 'Adequação (2)'), 'Não informado');
  });

  it('prints "Não informado" for the teacher and for the pairs of a PEI entry that lacks them', () => {
    const report = { screening: null, peiEntries };
    const titulo = TITULOS_PEI[1];

    assert.equal(valueOf(report, titulo, 'Professor(a)'), 'Não informado');
    assert.equal(valueOf(report, titulo, 'Conteúdo previsto na ementa e adequação'), 'Não informado');
    assert.equal(valueOf(report, titulo, 'Conteúdos priorizados no semestre'), 'Não informado');
    assert.equal(valueOf(report, titulo, 'Observações gerais'), 'Prefere atividades em dupla');
  });

  it('prints one section per period with the course first and then the identification in the order of the screen', () => {
    const report = { screening: null, aeePlans };

    assert.deepEqual(rowsOf(report, 'PAEE - 2026.2')?.slice(0, 6), [
      { label: 'Curso', value: 'Informática' },
      { label: 'Disciplina', value: 'Matemática' },
      { label: 'Período letivo', value: '2026.2' },
      { label: 'Professor(a) do AEE', value: 'Marina Duarte' },
      { label: 'Carga horária semanal do AEE', value: '4 horas' },
      { label: 'Disciplinas em que o estudante está matriculado', value: 'Matemática e Física' },
    ]);
  });

  it('prints "Não informado" for the course of a student without course, and no course row when the API does not send the student', () => {
    const titulo = 'PAEE - 2026.2';
    const [recente, anterior] = aeePlans;
    const semCurso = { ...recente, student: { course: null } };
    const semEstudante = { ...recente, student: undefined } as unknown as AeePlansReport[number];

    assert.equal(
      valueOf({ screening: null, aeePlans: [semCurso, anterior] }, titulo, 'Curso'),
      'Não informado',
    );
    assert.equal(
      rowsOf({ screening: null, aeePlans: [semEstudante, anterior] }, titulo)?.some(
        (row) => row.label === 'Curso',
      ),
      false,
    );
  });

  it('prints the diagnosis, the checked supports and purposes and the texts of the PAEE, with the labels of the screen', () => {
    const report = { screening: null, aeePlans };
    const titulo = 'PAEE - 2026.2';
    const apoios = 'Outros apoios e serviços, internos e externos';

    assert.equal(valueOf(report, titulo, 'Há laudo/diagnóstico?'), 'Sim');
    assert.equal(valueOf(report, titulo, apoios), '• Psicologia\n• Área médica');
    assert.equal(valueOf(report, titulo, `${apoios}: especialidade`), 'Neurologia');
    assert.equal(valueOf(report, titulo, `${apoios}: outros`), 'Monitoria');
    assert.equal(
      valueOf(report, titulo, 'Finalidade do AEE'),
      '• Acompanhamento sistemático do estudante',
    );
    assert.equal(valueOf(report, titulo, 'Objetivo geral do AEE'), 'Ampliar a autonomia');
    assert.equal(valueOf(report, titulo, 'Objetivos específicos do AEE'), 'Não informado');
  });

  it('prints "Não informado" for the author and the weekly hours of a PAEE that lacks them', () => {
    const report = { screening: null, aeePlans };
    const titulo = 'PAEE - 2026.1';

    assert.equal(valueOf(report, titulo, 'Professor(a) do AEE'), 'Não informado');
    assert.equal(valueOf(report, titulo, 'Carga horária semanal do AEE'), 'Não informado');
    assert.equal(valueOf(report, titulo, 'Há laudo/diagnóstico?'), 'Não');
    assert.equal(
      valueOf(report, titulo, 'Outros apoios e serviços, internos e externos'),
      'Nenhuma opção marcada',
    );
  });

  it('prints the identification of the case study with the author as the AEE teacher', () => {
    const report = { screening: null, caseStudy };
    const titulo = 'Estudo de Caso - Identificação';

    assert.equal(valueOf(report, titulo, 'Ano/série'), '2º ano');
    assert.equal(valueOf(report, titulo, 'Idade'), '16 anos');
    assert.equal(valueOf(report, titulo, 'Professor(a) do AEE'), 'Marina Duarte');
    assert.equal(valueOf(report, titulo, 'Data'), '17/10/2026');
  });

  it('prints the course of the student first in the identification of the case study', () => {
    const titulo = 'Estudo de Caso - Identificação';
    const report = { screening: null, caseStudy };

    assert.equal(rowsOf(report, titulo)?.[0]?.label, 'Curso');
    assert.equal(valueOf(report, titulo, 'Curso'), 'Informática');
  });

  it('prints "Não informado" for a student without course, and no course row when the API does not send the student', () => {
    const titulo = 'Estudo de Caso - Identificação';
    const semCurso = { ...caseStudy, student: { course: null } };
    const semEstudante = { ...caseStudy, student: undefined } as unknown as CaseStudyReport;

    assert.equal(
      valueOf({ screening: null, caseStudy: semCurso }, titulo, 'Curso'),
      'Não informado',
    );
    assert.equal(
      rowsOf({ screening: null, caseStudy: semEstudante }, titulo)?.some(
        (row) => row.label === 'Curso',
      ),
      false,
    );
  });

  it('lists only the checked items of the pedagogical checklists, with the labels of the screen', () => {
    const report = { screening: null, caseStudy };
    const titulo = 'Estudo de Caso - Aspectos pedagógicos';

    assert.equal(
      valueOf(report, titulo, 'Linguagem e comunicação'),
      '• Comunica-se verbalmente\n• Necessita de mediação frequente',
    );
    assert.equal(valueOf(report, titulo, 'Linguagem e comunicação: observações'), 'Frases curtas');
    assert.equal(valueOf(report, titulo, 'Matemática'), 'Nenhuma opção marcada');
  });

  it('prints the texts of the case study and "Não informado" for the ones that are missing', () => {
    const report = { screening: null, caseStudy };

    assert.equal(
      valueOf(
        report,
        'Estudo de Caso - Barreiras para aprendizagem e participação',
        'Barreiras para aprendizagem e participação',
      ),
      'Ruído na sala',
    );
    assert.equal(valueOf(report, 'Estudo de Caso - Informações gerais', 'Diagnóstico'), 'Não informado');
  });

  it('marks a missing section with null rows', () => {
    assert.equal(rowsOf({ screening }, TITULO_PEI), null);
  });

  it('prints a text field with the form label', () => {
    const report = { screening: { report: 'Laudo de 2026' } as Screening };

    assert.equal(valueOf(report, 'Triagem', 'Relatório médico'), 'Laudo de 2026');
  });

  it('prints "Não informado" for an empty, blank or missing text field', () => {
    for (const report of ['', '   ', null, undefined]) {
      const data = { screening: { report } as unknown as Screening };

      assert.equal(valueOf(data, 'Triagem', 'Relatório médico'), 'Não informado');
    }
  });

  it('lists only the checked options of a group, one per line, with the form labels', () => {
    const report = {
      screening: {
        specific_need: { deficiencia_fisica: false, baixa_visao: true, cegueira: true, outros: '' },
      } as unknown as Screening,
    };

    assert.equal(
      valueOf(report, 'Triagem', 'Necessidade Específica'),
      '• Baixa Visão\n• Cegueira',
    );
  });

  it('appends the "Outro" text of a group', () => {
    const report = {
      screening: {
        specific_need: { baixa_visao: true, outros: 'Dislexia' },
      } as unknown as Screening,
    };

    assert.equal(valueOf(report, 'Triagem', 'Necessidade Específica'), '• Baixa Visão\n• Outro: Dislexia');
  });

  it('follows the form order and leaves "Outro" last, whatever order the database returns', () => {
    const report = {
      screening: {
        specific_need: { outros: 'Dislexia', baixa_visao: true, deficiencia_auditiva: true },
      } as unknown as Screening,
    };

    assert.equal(
      valueOf(report, 'Triagem', 'Necessidade Específica'),
      '• Deficiência Auditiva/Surdez\n• Baixa Visão\n• Outro: Dislexia',
    );
  });

  it('makes a text from the key for options without a form label, and accepts "outro" in the singular', () => {
    const report = {
      screening: {
        specific_need: { opcao_sem_rotulo: true, organizacao: false },
        physical_disability: { outro: 'Monitor' },
      } as unknown as Screening,
    };

    assert.equal(valueOf(report, 'Triagem', 'Necessidade Específica'), '• Opcao Sem Rotulo');
    assert.equal(valueOf(report, 'Triagem', 'Deficiência Física'), '• Outro: Monitor');
  });

  it('prints "Nenhuma opção marcada" for a group without any checked option', () => {
    const report = {
      screening: { physical_disability: { acesso_para_cadeirante: false, outros: '' } } as unknown as Screening,
    };

    assert.equal(valueOf(report, 'Triagem', 'Deficiência Física'), 'Nenhuma opção marcada');
  });

  it('prints only the fields of the forms', () => {
    const report = {
      screening: { report: 'Laudo', email: 'aluno@example.test', special_service: true } as unknown as Screening,
    };

    const labels = rowsOf(report, 'Triagem')?.map((r) => r.label);

    assert.deepEqual(labels, [
      'Relatório médico',
      'Necessidade Específica',
      'Deficiência Física',
      'Deficiência Visual',
      'Deficiência Auditiva',
      'Transtornos Globais / Altas Habilidades',
      'Outros casos de deficiência',
    ]);
  });
});

describe('reportFileName', () => {
  it('names the file after the student', () => {
    assert.equal(reportFileName('Maria da Silva'), 'Relatorio_Maria_da_Silva.pdf');
  });

  it('removes characters that are invalid in a file name', () => {
    assert.equal(reportFileName(' Ana/Clara: "Souza"* '), 'Relatorio_AnaClara_Souza.pdf');
  });

  it('falls back to a generic name without the student name', () => {
    assert.equal(reportFileName(''), 'Relatorio_estudante.pdf');
  });
});
