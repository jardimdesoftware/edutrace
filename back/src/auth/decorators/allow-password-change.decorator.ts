import { SetMetadata } from '@nestjs/common';

export const ALLOW_PASSWORD_CHANGE_KEY = 'allowPasswordChange';

// Libera a rota para quem ainda precisa trocar a senha do primeiro acesso.
// Não usar @Levels para isso: aquele decorator é uma lista de níveis
// bloqueados, não de permissões.
export const AllowPasswordChange = () =>
  SetMetadata(ALLOW_PASSWORD_CHANGE_KEY, true);
