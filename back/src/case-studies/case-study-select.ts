import { Prisma } from '@prisma/client';

// As seções do estudo de caso, sem o id, o estudante, o autor nem as datas.
// Também é a base do relatório.
export const CASE_STUDY_SECTIONS_SELECT = {
  identification: true,
  general_info: true,
  school_history: true,
  pedagogical_aspects: true,
  behavioral_social: true,
  potentialities_interests: true,
  barriers: true,
  resources_strategies: true,
  pei_recommendations: true,
  aee_opinion: true,
} satisfies Prisma.CaseStudySelect;

// Resposta de criar, ler e editar. O autor e o estudante saem pelo select
// explícito: o autor só com o id e o nome, e o estudante só com o nome e o
// curso (o estudante que lê o próprio estudo de caso não tem outra rota que
// devolva o curso). O User inteiro traria o CPF, o e-mail e o hash da senha.
export const CASE_STUDY_SELECT = {
  ...CASE_STUDY_SECTIONS_SELECT,
  author: { select: { id: true, full_name: true } },
  student: { select: { full_name: true, course: true } },
  created_at: true,
  updated_at: true,
} satisfies Prisma.CaseStudySelect;
