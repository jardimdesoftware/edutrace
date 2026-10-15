import { SetMetadata } from '@nestjs/common';

export const ALLOW_INCOMPLETE_REGISTRATION_KEY = 'allowIncompleteRegistration';

// Libera a rota para quem entrou pelo Google e ainda não cadastrou CPF e senha.
// Não substitui o @AllowLevels: a rota continua precisando declarar os níveis.
export const AllowIncompleteRegistration = () =>
  SetMetadata(ALLOW_INCOMPLETE_REGISTRATION_KEY, true);
