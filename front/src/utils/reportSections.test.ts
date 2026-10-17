import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ReportsData } from '@/interfaces/ReportsData';
import { buildReportSections, relatorioVazio, reportFileName } from './reportSections';

type Screening = NonNullable<ReportsData['screening']>;
type PlansEducation = NonNullable<ReportsData['plansEducation']>;
type CaseStudyReport = NonNullable<ReportsData['caseStudy']>;

const screening = { report: 'Laudo' } as Screening;
const plansEducation = { objectives: 'Objetivos' } as PlansEducation;
const caseStudy = {
  identification: { grade: '2º ano', age: 16, date: '2026-10-17' },
  pedagogical_aspects: { language: { verbal: true, frequent_mediation: true, notes: 'Frases curtas' } },
  barriers: 'Ruído na sala',
  author: { id: 7, full_name: 'Marina Duarte' },
  student: { course: 'Informática' },
} as unknown as CaseStudyReport;

const TITULO_PEI = 'PEI - Plano de Ensino Individualizado';
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
  it('is empty when the student has neither screening, PEI nor case study', () => {
    assert.equal(relatorioVazio({ screening: null, plansEducation: null }), true);
    assert.equal(relatorioVazio({ screening: null, plansEducation: null, caseStudy: null }), true);
  });

  it('is not empty with only the case study', () => {
    assert.equal(relatorioVazio({ screening: null, plansEducation: null, caseStudy }), false);
  });

  it('is not empty with only the screening', () => {
    assert.equal(relatorioVazio({ screening, plansEducation: null }), false);
  });

  it('is not empty with only the PEI', () => {
    assert.equal(relatorioVazio({ screening: null, plansEducation }), false);
  });
});

describe('buildReportSections', () => {
  it('lists the screening, the PEI and the case study, in this order and without the anamnesis', () => {
    const titles = buildReportSections({ screening, plansEducation, caseStudy }).map((s) => s.title);

    assert.deepEqual(titles, ['Triagem', TITULO_PEI, ...TITULOS_ESTUDO_DE_CASO]);
  });

  it('marks a missing case study with a single section without rows, also when the API does not send it', () => {
    for (const data of [{ caseStudy: null }, {}]) {
      const sections = buildReportSections({ screening, plansEducation, ...data });
      const last = sections[sections.length - 1];

      assert.equal(last.title, 'Estudo de Caso');
      assert.equal(last.rows, null);
      assert.equal(sections.length, 3);
    }
  });

  it('prints the identification of the case study with the author as the AEE teacher', () => {
    const report = { screening: null, plansEducation: null, caseStudy };
    const titulo = 'Estudo de Caso - Identificação';

    assert.equal(valueOf(report, titulo, 'Ano/série'), '2º ano');
    assert.equal(valueOf(report, titulo, 'Idade'), '16 anos');
    assert.equal(valueOf(report, titulo, 'Professor(a) do AEE'), 'Marina Duarte');
    assert.equal(valueOf(report, titulo, 'Data'), '17/10/2026');
  });

  it('prints the course of the student first in the identification of the case study', () => {
    const titulo = 'Estudo de Caso - Identificação';
    const report = { screening: null, plansEducation: null, caseStudy };

    assert.equal(rowsOf(report, titulo)?.[0]?.label, 'Curso');
    assert.equal(valueOf(report, titulo, 'Curso'), 'Informática');
  });

  it('prints "Não informado" for a student without course, and no course row when the API does not send the student', () => {
    const titulo = 'Estudo de Caso - Identificação';
    const semCurso = { ...caseStudy, student: { course: null } };
    const semEstudante = { ...caseStudy, student: undefined } as unknown as CaseStudyReport;

    assert.equal(
      valueOf({ screening: null, plansEducation: null, caseStudy: semCurso }, titulo, 'Curso'),
      'Não informado',
    );
    assert.equal(
      rowsOf({ screening: null, plansEducation: null, caseStudy: semEstudante }, titulo)?.some(
        (row) => row.label === 'Curso',
      ),
      false,
    );
  });

  it('lists only the checked items of the pedagogical checklists, with the labels of the screen', () => {
    const report = { screening: null, plansEducation: null, caseStudy };
    const titulo = 'Estudo de Caso - Aspectos pedagógicos';

    assert.equal(
      valueOf(report, titulo, 'Linguagem e comunicação'),
      '• Comunica-se verbalmente\n• Necessita de mediação frequente',
    );
    assert.equal(valueOf(report, titulo, 'Linguagem e comunicação: observações'), 'Frases curtas');
    assert.equal(valueOf(report, titulo, 'Matemática'), 'Nenhuma opção marcada');
  });

  it('prints the texts of the case study and "Não informado" for the ones that are missing', () => {
    const report = { screening: null, plansEducation: null, caseStudy };

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
    assert.equal(rowsOf({ screening, plansEducation: null }, TITULO_PEI), null);
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
