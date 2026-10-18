import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ReportsData } from '@/interfaces/ReportsData';
import { exportStudentReportPdf, renderReportPdf } from './exportStudentReport';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const estudante = { email: 'aluno@example.test', full_name: 'João da Conceição' };

const screening = {
  report: 'Avaliação com acentuação: ç, ã, õ, é, ê, à',
  specific_need: { baixa_visao: true, outros: 'Dislexia' },
} as unknown as NonNullable<ReportsData['screening']>;

const caseStudy = {
  identification: { grade: '2º ano', age: 16, date: '2026-10-17' },
  pedagogical_aspects: { language: { verbal: true, notes: 'Fala frases curtas' } },
  barriers: 'Ruído na sala de aula',
  author: { id: 7, full_name: 'Marina Duarte' },
  student: { course: 'Informática' },
} as unknown as NonNullable<ReportsData['caseStudy']>;

const peiEntry: NonNullable<ReportsData['peiEntries']>[number] = {
  semester: '2026.2',
  subject: 'Matemática',
  adapted_objectives: 'Ampliar a autonomia nas operacoes',
  prioritized_contents: 'Funcoes e geometria',
  syllabus_adaptations: [
    { syllabus_content: 'Funcoes do primeiro grau', adaptation: 'Usar material concreto' },
  ],
  adapted_methodologies: 'Aulas com recursos visuais',
  adapted_assessments: 'Prova com tempo ampliado',
  adapted_resources: 'Calculadora e abaco',
  general_notes: 'Responde bem a atividades em dupla',
  semester_progress: 'Resolve as operacoes sozinho',
  semester_difficulties: 'Perde o foco em provas longas',
  next_semester_notes: 'Manter o tempo ampliado',
  individual_sessions: 'Tercas as 14h na sala 3',
  author: { full_name: 'Professora Ana' },
};

const peiEntries = [
  peiEntry,
  {
    ...peiEntry,
    semester: '2026.1',
    subject: 'Inglês',
    syllabus_adaptations: [],
    semester_progress: '',
    semester_difficulties: '',
    next_semester_notes: '',
    individual_sessions: '',
    author: null,
  },
];

describe('renderReportPdf', () => {
  it('draws the student, the filled sections and marks the missing one', async () => {
    const doc = await renderReportPdf(estudante, { screening });
    const pdf = doc.output();

    assert.equal(doc.getNumberOfPages(), 1);
    assert.match(pdf, /Relat.rio do estudante/);
    assert.match(pdf, /aluno@example\.test/);
    assert.match(pdf, /\(Triagem\)/);
    assert.match(pdf, /\(PEI\)/);
    assert.match(pdf, /Ficha n.o preenchida/);
    assert.doesNotMatch(pdf, /Anamnese/);
  });

  it('draws the sections of the case study with the author and the checked items', async () => {
    const doc = await renderReportPdf(estudante, { screening: null, caseStudy });
    const pdf = doc.output();

    assert.match(pdf, /Estudo de Caso - Identifica/);
    assert.match(pdf, /Estudo de Caso - Aspectos pedag/);
    assert.match(pdf, /Marina Duarte/);
    assert.match(pdf, /Curso/);
    assert.match(pdf, /Inform.tica/);
    assert.match(pdf, /Comunica-se verbalmente/);
    assert.match(pdf, /Ru.do na sala de aula/);
  });

  it('draws one section per period of the PAEE, with the course, the teacher and the checked supports', async () => {
    const aeePlans = [
      {
        semester: '2026.1',
        identification: { subject: 'Matemática', weekly_hours: 4, enrolled_subjects: 'Matemática' },
        basis: 'Embasamento do atendimento',
        has_diagnosis: true,
        supports: { psychology: true, medical: false, medical_specialty: '', other: '' },
        purpose: { systematic_follow_up: true, other: '' },
        objectives: { general: 'Ampliar a autonomia', specific: '' },
        evaluation_procedures: 'Registro semanal',
        author: { full_name: 'Marina Duarte' },
        student: { course: 'Informática' },
      },
    ] as unknown as NonNullable<ReportsData['aeePlans']>;

    const doc = await renderReportPdf(estudante, { screening: null, aeePlans });
    const pdf = doc.output();

    assert.match(pdf, /PAEE - 2026\.1/);
    assert.match(pdf, /Curso/);
    assert.match(pdf, /Inform.tica/);
    assert.match(pdf, /Marina Duarte/);
    assert.match(pdf, /Psicologia/);
    assert.match(pdf, /Ampliar a autonomia/);
    assert.match(pdf, /Registro semanal/);
  });

  it('draws one section per PEI entry, with the semester, the subject, the teacher and the pairs', async () => {
    const doc = await renderReportPdf(estudante, { screening: null, peiEntries });
    const pdf = doc.output();

    assert.match(pdf, /PEI - 2026\.2 - Matem.tica/);
    assert.match(pdf, /PEI - 2026\.1 - Ingl.s/);
    assert.match(pdf, /Professora Ana/);
    assert.match(pdf, /Ampliar a autonomia nas operacoes/);
    assert.match(pdf, /Conte.do previsto na ementa/);
    assert.match(pdf, /Funcoes do primeiro grau/);
    assert.match(pdf, /Adequa..o/);
    assert.match(pdf, /Usar material concreto/);
    assert.match(pdf, /Prova com tempo ampliado/);
  });

  it('breaks a long answer across pages and numbers them', async () => {
    const peiEntries = [
      { ...peiEntry, adapted_objectives: 'Objetivo de aprendizagem. '.repeat(1500) },
    ];

    const doc = await renderReportPdf(estudante, { screening, peiEntries });
    const pages = doc.getNumberOfPages();

    assert.ok(pages > 1, `expected more than one page, got ${pages}`);
    assert.match(doc.output(), new RegExp(`P.gina ${pages} de ${pages}`));
  });
});

describe('exportStudentReportPdf', () => {
  it('returns "empty" without drawing when the student has neither screening nor PEI', async () => {
    const urls: string[] = [];
    process.env.NEXT_PUBLIC_API_EDU_TRACE = 'http://api.test';
    globalThis.fetch = (async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify({ screening: null, peiEntries: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    const result = await exportStudentReportPdf(estudante);

    assert.equal(result, 'empty');
    assert.deepEqual(urls, ['http://api.test/reports/aluno%40example.test']);
  });
});
