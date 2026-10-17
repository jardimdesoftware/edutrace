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

describe('renderReportPdf', () => {
  it('draws the student, the filled sections and marks the missing one', async () => {
    const doc = await renderReportPdf(estudante, { screening, plansEducation: null });
    const pdf = doc.output();

    assert.equal(doc.getNumberOfPages(), 1);
    assert.match(pdf, /Relat.rio do estudante/);
    assert.match(pdf, /aluno@example\.test/);
    assert.match(pdf, /\(Triagem\)/);
    assert.match(pdf, /PEI - Plano de Ensino Individualizado/);
    assert.match(pdf, /Ficha n.o preenchida/);
    assert.doesNotMatch(pdf, /Anamnese/);
  });

  it('draws the sections of the case study with the author and the checked items', async () => {
    const doc = await renderReportPdf(estudante, { screening: null, plansEducation: null, caseStudy });
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

    const doc = await renderReportPdf(estudante, { screening: null, plansEducation: null, aeePlans });
    const pdf = doc.output();

    assert.match(pdf, /PAEE - 2026\.1/);
    assert.match(pdf, /Curso/);
    assert.match(pdf, /Inform.tica/);
    assert.match(pdf, /Marina Duarte/);
    assert.match(pdf, /Psicologia/);
    assert.match(pdf, /Ampliar a autonomia/);
    assert.match(pdf, /Registro semanal/);
  });

  it('breaks a long answer across pages and numbers them', async () => {
    const plansEducation = {
      objectives: 'Objetivo de aprendizagem. '.repeat(1500),
    } as unknown as NonNullable<ReportsData['plansEducation']>;

    const doc = await renderReportPdf(estudante, { screening, plansEducation });
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
      return new Response(JSON.stringify({ screening: null, plansEducation: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    const result = await exportStudentReportPdf(estudante);

    assert.equal(result, 'empty');
    assert.deepEqual(urls, ['http://api.test/reports/aluno%40example.test']);
  });
});
