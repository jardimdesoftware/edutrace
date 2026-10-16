import { Prisma } from '@prisma/client';

// Lista dos campos que podem sair na resposta da API. Por ser uma lista de
// permissão, campo novo no model User fica de fora até ser incluído aqui, o que
// evita que uma coluna sensível vaze por esquecimento.
//
// Ficam de fora: password, os campos de recuperação de senha, o link de ativação
// da conta, os contadores de bloqueio de login e as anotações sobre o usuário,
// que têm rota própria (GET /comments/:id_user) com o controle de acesso delas.
//
// O Profissional NAPNE responsável é uma relação, e relação com `true` ou
// `include` devolveria o registro inteiro dele, com o hash da senha. Por isso só
// o id e o nome saem.
export const PUBLIC_USER_SELECT = {
  id: true,
  full_name: true,
  affliation: true,
  cpf: true,
  pedagogical_manager: true,
  current_phase: true,
  created_at: true,
  deleted_at: true,
  email: true,
  id_current_phase: true,
  id_level: true,
  level: true,
  enrollment_number: true,
  course: true,
  service_status: true,
  queued_at: true,
  service_started_at: true,
  service_closed_at: true,
  service_capacity: true,
  napne_responsible: { select: { id: true, full_name: true } },
  updated_at: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{
  select: typeof PUBLIC_USER_SELECT;
}>;
