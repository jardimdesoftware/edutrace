import { LEVELS, PROFESSIONAL_ROLES } from 'src/constants';

const KNOWN_ROLES: readonly number[] = Object.values(LEVELS);

// Devolve a mensagem da primeira regra de composição quebrada, ou null quando a
// lista é válida. Os mesmos CHECKs existem no banco (migration
// 20261026100000_add_user_roles): a lista não pode ser vazia, só leva papéis
// conhecidos, sem repetição, e o Administrador e o Estudante/Família ficam
// sozinhos.
export function rolesCompositionError(roles: unknown): string | null {
  if (!Array.isArray(roles) || roles.length === 0) {
    return 'O campo roles deve ser uma lista com ao menos um papel.';
  }
  if (!roles.every((role) => Number.isInteger(role))) {
    return 'O campo roles deve ter apenas números inteiros.';
  }
  const list = roles as number[];
  if (!list.every((role) => KNOWN_ROLES.includes(role))) {
    return 'O campo roles deve ter apenas papéis de acesso existentes.';
  }
  if (new Set(list).size !== list.length) {
    return 'O campo roles não deve repetir papéis.';
  }
  if (
    list.length > 1 &&
    !list.every((role) => PROFESSIONAL_ROLES.includes(role))
  ) {
    return 'Administrador e Estudante/Família não combinam com outros papéis.';
  }
  return null;
}

export function sortRoles(roles: readonly number[]): number[] {
  return [...roles].sort((a, b) => a - b);
}

export function sameRoles(a: readonly number[], b: readonly number[]): boolean {
  const left = sortRoles(a);
  const right = sortRoles(b);
  return left.length === right.length && left.every((r, i) => r === right[i]);
}
