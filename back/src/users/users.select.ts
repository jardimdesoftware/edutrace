import { Prisma } from '@prisma/client';

// Lista dos campos que podem sair na resposta da API. Por ser uma lista de
// permissão, campo novo no model User fica de fora até ser incluído aqui, o que
// evita que uma coluna sensível vaze por esquecimento.
//
// Ficam de fora: password, os campos de recuperação de senha e os contadores de
// bloqueio de login.
export const PUBLIC_USER_SELECT = {
  id: true,
  full_name: true,
  affliation: true,
  cpf: true,
  pedagogical_manager: true,
  comments: true,
  current_phase: true,
  created_at: true,
  deleted_at: true,
  email: true,
  id_current_phase: true,
  id_level: true,
  level: true,
  updated_at: true,
} satisfies Prisma.UserSelect;
