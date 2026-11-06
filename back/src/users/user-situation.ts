// Situação pedida na lista de usuários do administrador. A lista padrão mostra os
// ativos e os que estão na carência, e esconde os desativados.
export const USER_SITUATIONS = {
  DEFAULT: 'padrao',
  GRACE: 'carencia',
  DEACTIVATED: 'desativados',
} as const;

export type UserSituation =
  (typeof USER_SITUATIONS)[keyof typeof USER_SITUATIONS];
