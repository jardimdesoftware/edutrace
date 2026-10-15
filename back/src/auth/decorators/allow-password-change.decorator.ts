import { SetMetadata } from '@nestjs/common';

export const ALLOW_PASSWORD_CHANGE_KEY = 'allowPasswordChange';

// Libera a rota para quem ainda precisa trocar a senha do primeiro acesso.
// Não substitui o @AllowLevels: a rota continua precisando declarar os níveis.
export const AllowPasswordChange = () =>
  SetMetadata(ALLOW_PASSWORD_CHANGE_KEY, true);
