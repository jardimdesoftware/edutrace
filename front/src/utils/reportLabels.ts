import type { ReportsData } from '@/interfaces/ReportsData';

export interface ReportFieldDef {
  key: string;
  label: string;
  options?: Record<string, string>;
}

export interface ReportSectionDef {
  key: keyof ReportsData;
  title: string;
  fields: ReportFieldDef[];
}

// Títulos e rótulos copiados da tela de triagem, na mesma ordem. Só sai no
// relatório o campo listado aqui. As outras fichas do relatório (estudo de caso,
// PAEE e PEI) têm a tabela de rótulos no próprio documento.
export const REPORT_SECTIONS: ReportSectionDef[] = [
  {
    key: 'screening',
    title: 'Triagem',
    fields: [
      { key: 'report', label: 'Relatório médico' },
      {
        key: 'specific_need',
        label: 'Necessidade Específica',
        options: {
          deficiencia_fisica: 'Deficiência Física',
          deficiencia_auditiva: 'Deficiência Auditiva/Surdez',
          baixa_visao: 'Baixa Visão',
          surdocegueira: 'Surdocegueira',
          cegueira: 'Cegueira',
          superdotacao: 'Altas habilidades/superdotação',
          transtornos_globais_de_desenvolvimento: 'Transtornos globais do desenvolvimento',
          disturbio_de_aprendizagem: 'Distúrbios de aprendizagem',
        },
      },
      {
        key: 'physical_disability',
        label: 'Deficiência Física',
        options: {
          necessita_de_transcritor: 'Necessita de transcritor',
          acesso_para_cadeirante: 'Necessita de acesso para cadeirante',
        },
      },
      {
        key: 'visual_impairment',
        label: 'Deficiência Visual',
        options: {
          necessita_de_braille: 'Necessita de material didático em Braille',
          material_com_fonte_aumentada: 'Material com fonte aumentada',
          necessita_de_transcritor: 'Necessita de transcritor',
        },
      },
      {
        key: 'hearing_impairment',
        label: 'Deficiência Auditiva',
        options: {
          necessita_de_interprete_de_lingua_de_sinais: 'Necessita de intérprete de língua de sinais',
          necessita_de_interprete_oralizador: 'Necessita de intérprete oralizador',
        },
      },
      {
        key: 'global_disorder',
        label: 'Transtornos Globais / Altas Habilidades',
        options: {
          necessita_de_ledor: 'Necessita de ledor',
          necessita_de_transcritor: 'Necessita de transcritor',
        },
      },
      { key: 'other_disabilities', label: 'Outros casos de deficiência' },
    ],
  },
];
