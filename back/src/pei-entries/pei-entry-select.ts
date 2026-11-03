import { Prisma } from '@prisma/client';

// Os sete campos de conteúdo do registro do PEI, sem o id, o semestre, a
// disciplina, o estudante, o autor nem as datas. É a base da resposta e do
// relatório, e as chaves dela são as colunas que o service grava ao criar e ao
// editar.
export const PEI_ENTRY_CONTENT_SELECT = {
  adapted_objectives: true,
  prioritized_contents: true,
  syllabus_adaptations: true,
  adapted_methodologies: true,
  adapted_assessments: true,
  adapted_resources: true,
  general_notes: true,
} satisfies Prisma.PeiEntrySelect;

// Os quatro campos do parecer semestral do professor: os avanços, as
// dificuldades, os apontamentos para o próximo semestre e os atendimentos
// individualizados prestados. Só o autor os escreve, pelo PATCH; o registro
// nasce com os quatro em branco. As chaves também são as colunas que o service
// grava ao editar (o create não grava nenhuma).
export const PEI_ENTRY_OPINION_SELECT = {
  semester_progress: true,
  semester_difficulties: true,
  next_semester_notes: true,
  individual_sessions: true,
} satisfies Prisma.PeiEntrySelect;

// Resposta de criar, ler e editar. O autor sai pelo select explícito, só com o
// nome: o User inteiro traria o CPF, o e-mail e o hash da senha. O estudante e o
// deleted_at não saem: o estudante já é o da rota, e o registro excluído nunca é
// devolvido.
export const PEI_ENTRY_SELECT = {
  id: true,
  semester: true,
  subject: true,
  ...PEI_ENTRY_CONTENT_SELECT,
  ...PEI_ENTRY_OPINION_SELECT,
  created_at: true,
  updated_at: true,
  id_author: true,
  author: { select: { full_name: true } },
} satisfies Prisma.PeiEntrySelect;

// Do semestre mais recente para o mais antigo e, no mesmo semestre, pela
// disciplina em ordem alfabética. O AAAA.S ordena como texto: o ano de quatro
// dígitos vem primeiro, e o semestre é 1 ou 2.
export const PEI_ENTRY_ORDER_BY: Prisma.PeiEntryOrderByWithRelationInput[] = [
  { semester: 'desc' },
  { subject: 'asc' },
];
