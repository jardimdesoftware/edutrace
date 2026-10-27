import { Prisma } from '@prisma/client';
import { MANAGER_CONTACT_READERS } from 'src/constants';
import { hasAnyRole } from 'src/auth/roles';

// Lista dos campos que podem sair na resposta da API. Por ser uma lista de
// permissão, campo novo no model User fica de fora até ser incluído aqui, o que
// evita que uma coluna sensível vaze por esquecimento.
//
// Ficam de fora: password, os campos de recuperação de senha, o link de ativação
// da conta, os contadores de bloqueio de login e as anotações sobre o usuário,
// que têm rota própria (GET /comments/:id_user) com o controle de acesso delas.
//
// O Professor do AEE responsável e o responsável pedagógico são relações, e
// relação com `true` ou `include` devolveria o registro inteiro do servidor, com
// o hash da senha. Por isso só o id e o nome saem. O responsável pedagógico
// externo sai pelo nome. O telefone e o CPF dele, dados de quem não usa o
// sistema, ficam de fora deste select e só entram em
// USER_WITH_MANAGER_CONTACT_SELECT, que userSelectFor entrega aos níveis que
// administram o vínculo. O texto livre antigo, pedagogical_manager_legacy, fica
// de fora do client.
export const PUBLIC_USER_SELECT = {
  id: true,
  full_name: true,
  affliation: true,
  cpf: true,
  pedagogical_manager: { select: { id: true, full_name: true } },
  external_manager_name: true,
  current_phase: true,
  created_at: true,
  deleted_at: true,
  email: true,
  id_current_phase: true,
  roles: true,
  enrollment_number: true,
  course: true,
  service_status: true,
  queued_at: true,
  service_started_at: true,
  service_closed_at: true,
  aee_responsible: { select: { id: true, full_name: true } },
  updated_at: true,
} satisfies Prisma.UserSelect;

export const USER_WITH_MANAGER_CONTACT_SELECT = {
  ...PUBLIC_USER_SELECT,
  external_manager_phone: true,
  external_manager_cpf: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{
  select: typeof PUBLIC_USER_SELECT;
}>;

export type UserWithManagerContact = Prisma.UserGetPayload<{
  select: typeof USER_WITH_MANAGER_CONTACT_SELECT;
}>;

// Negação por padrão (ASVS 5.0 8.2.3; OWASP Authorization Cheat Sheet): o
// contato do responsável externo sai só para a lista de MANAGER_CONTACT_READERS,
// e quem tem papel fora dela, ausente ou desconhecido recebe o select público.
export function userSelectFor(roles: readonly number[]) {
  return hasAnyRole(roles, MANAGER_CONTACT_READERS)
    ? USER_WITH_MANAGER_CONTACT_SELECT
    : PUBLIC_USER_SELECT;
}
