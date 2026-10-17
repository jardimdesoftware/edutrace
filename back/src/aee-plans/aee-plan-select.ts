import { Prisma } from '@prisma/client';

// As seções do PAEE, sem o id, o período letivo, o estudante, o autor nem as
// datas. É a base da resposta e do relatório, e as chaves dela são as colunas
// que o service grava ao criar e ao editar.
export const AEE_PLAN_SECTIONS_SELECT = {
  identification: true,
  basis: true,
  has_diagnosis: true,
  supports: true,
  purpose: true,
  objectives: true,
  evaluation_procedures: true,
} satisfies Prisma.AeePlanSelect;

// Resposta de criar, ler e editar. O autor e o estudante saem pelo select
// explícito: o autor só com o id e o nome, e o estudante só com o nome e o
// curso (o estudante que lê o próprio PAEE não tem outra rota que devolva o
// curso). O User inteiro traria o CPF, o e-mail e o hash da senha.
export const AEE_PLAN_SELECT = {
  id: true,
  semester: true,
  ...AEE_PLAN_SECTIONS_SELECT,
  author: { select: { id: true, full_name: true } },
  student: { select: { full_name: true, course: true } },
  created_at: true,
  updated_at: true,
} satisfies Prisma.AeePlanSelect;
