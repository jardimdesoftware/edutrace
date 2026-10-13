import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ReportsData } from '@/interfaces/ReportsData';
import { buildReportSections, relatorioVazio, reportFileName } from './reportSections';

type Screening = NonNullable<ReportsData['screening']>;
type PlansEducation = NonNullable<ReportsData['plansEducation']>;

const screening = { report: 'Laudo' } as Screening;
const plansEducation = { objectives: 'Objetivos' } as PlansEducation;

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
  it('is empty when the student has neither screening nor PEI', () => {
    assert.equal(relatorioVazio({ screening: null, plansEducation: null }), true);
  });

  it('is not empty with only the screening', () => {
    assert.equal(relatorioVazio({ screening, plansEducation: null }), false);
  });

  it('is not empty with only the PEI', () => {
    assert.equal(relatorioVazio({ screening: null, plansEducation }), false);
  });
});

describe('buildReportSections', () => {
  it('lists the screening and the PEI, in this order and without the anamnesis', () => {
    const titles = buildReportSections({ screening, plansEducation }).map((s) => s.title);

    assert.deepEqual(titles, ['Triagem', 'PEI - Plano de Ensino Individualizado']);
  });

  it('marks a missing section with null rows', () => {
    assert.equal(rowsOf({ screening, plansEducation: null }, 'PEI - Plano de Ensino Individualizado'), null);
  });

  it('prints a text field with the form label', () => {
    const report = { screening: { report: 'Laudo de 2026' } as Screening, plansEducation: null };

    assert.equal(valueOf(report, 'Triagem', 'Relatório médico'), 'Laudo de 2026');
  });

  it('prints "Não informado" for an empty, blank or missing text field', () => {
    for (const report of ['', '   ', null, undefined]) {
      const data = { screening: { report } as unknown as Screening, plansEducation: null };

      assert.equal(valueOf(data, 'Triagem', 'Relatório médico'), 'Não informado');
    }
  });

  it('lists only the checked options of a group, one per line, with the form labels', () => {
    const report = {
      screening: {
        specific_need: { deficiencia_fisica: false, baixa_visao: true, cegueira: true, outros: '' },
      } as unknown as Screening,
      plansEducation: null,
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
      plansEducation: null,
    };

    assert.equal(valueOf(report, 'Triagem', 'Necessidade Específica'), '• Baixa Visão\n• Outro: Dislexia');
  });

  it('follows the form order and leaves "Outro" last, whatever order the database returns', () => {
    const report = {
      screening: {
        specific_need: { outros: 'Dislexia', baixa_visao: true, deficiencia_auditiva: true },
      } as unknown as Screening,
      plansEducation: null,
    };

    assert.equal(
      valueOf(report, 'Triagem', 'Necessidade Específica'),
      '• Deficiência Auditiva/Surdez\n• Baixa Visão\n• Outro: Dislexia',
    );
  });

  it('uses the same text as the PEI screen for options without a form label', () => {
    const report = {
      screening: null,
      plansEducation: {
        skills: { atencao_em_sala_de_aula: true, organizacao: false },
        support_service: { interprete: false, outro: 'Monitor' },
      } as unknown as PlansEducation,
    };

    assert.equal(
      valueOf(report, 'PEI - Plano de Ensino Individualizado', 'Habilidades e Potencialidades'),
      '• Atencao Em Sala De Aula',
    );
    assert.equal(
      valueOf(report, 'PEI - Plano de Ensino Individualizado', 'Serviço de Apoio'),
      '• Outro: Monitor',
    );
  });

  it('prints "Nenhuma opção marcada" for a group without any checked option', () => {
    const report = {
      screening: { physical_disability: { acesso_para_cadeirante: false, outros: '' } } as unknown as Screening,
      plansEducation: null,
    };

    assert.equal(valueOf(report, 'Triagem', 'Deficiência Física'), 'Nenhuma opção marcada');
  });

  it('prints only the fields of the forms', () => {
    const report = {
      screening: { report: 'Laudo', email: 'aluno@example.test', special_service: true } as unknown as Screening,
      plansEducation: null,
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
