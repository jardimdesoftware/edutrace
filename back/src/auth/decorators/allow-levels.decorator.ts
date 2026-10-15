import { SetMetadata } from '@nestjs/common';
import { LevelValue } from 'src/constants';

export const ALLOW_LEVELS_KEY = 'allowLevels';
export const ANY_LEVEL = 'any';

// Lista os níveis que podem chamar a rota. O AuthGuard nega por padrão: rota
// sem @Public, @AllowLevels ou @AllowAnyLevel responde 403 a qualquer nível.
export const AllowLevels = (...levels: LevelValue[]) =>
  SetMetadata(ALLOW_LEVELS_KEY, levels);

// Libera a rota para qualquer nível com sessão válida, inclusive os criados
// pelo administrador. Só para rotas da própria conta, como perfil e logout:
// rota com dado de estudante lista os níveis com @AllowLevels.
export const AllowAnyLevel = () => SetMetadata(ALLOW_LEVELS_KEY, ANY_LEVEL);
