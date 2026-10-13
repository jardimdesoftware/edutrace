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

// Títulos e rótulos copiados das telas de triagem e PEI, na mesma ordem. Só
// sai no relatório o campo listado aqui. As opções do PEI que a tela gera a
// partir da chave não têm rótulo próprio e usam o mesmo texto da tela.
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
  {
    key: 'plansEducation',
    title: 'PEI - Plano de Ensino Individualizado',
    fields: [
      { key: 'professor_name', label: 'Nome do Professor' },
      { key: 'professor_email', label: 'Email do Professor' },
      {
        key: 'academic_semester',
        label: 'Semestre Acadêmico',
        options: {
          primeiro_semestre: 'Primeiro Semestre',
          segundo_semestre: 'Segundo Semestre',
        },
      },
      {
        key: 'service_modality',
        label: 'Modalidade de Serviço',
        options: {
          turma_regular: 'Turma Regular',
          atendimento_pedagogico_domiciliar: 'Atendimento Pedagógico Domiciliar',
          atendimento_pedagogico_hospitalar: 'Atendimento Pedagógico Hospitalar',
        },
      },
      { key: 'support_service', label: 'Serviço de Apoio' },
      { key: 'skills', label: 'Habilidades e Potencialidades' },
      { key: 'resource_equipment_used', label: 'Recursos/Equipamentos já utilizados' },
      { key: 'resource_equipment_needs', label: 'Recursos/Equipamentos a providenciar' },
      { key: 'curriculum_accessibility', label: 'Acessibilidade Curricular' },
      { key: 'school_content', label: 'Conteúdo Escolar' },
      { key: 'activities_to_be_developed', label: 'Atividades a serem desenvolvidas' },
      { key: 'objectives', label: 'Objetivos' },
      { key: 'work_methodology', label: 'Metodologia de Trabalho' },
      { key: 'materials_used', label: 'Materiais Utilizados' },
      { key: 'evaluation_criteria', label: 'Critérios de Avaliação' },
    ],
  },
];
