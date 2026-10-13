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
