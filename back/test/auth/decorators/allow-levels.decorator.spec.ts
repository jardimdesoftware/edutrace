import { readdirSync } from 'fs';
import { join } from 'path';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { IS_PUBLIC_KEY } from 'src/auth/constants/constants';
import {
  ALLOW_LEVELS_KEY,
  ANY_LEVEL,
  AllowAnyLevel,
  AllowLevels,
} from 'src/auth/decorators/allow-levels.decorator';
import { LEVELS } from 'src/constants';

type Controller = { name: string; prototype: Record<string, unknown> };

function controllerFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return controllerFiles(path);
    return entry.name.endsWith('.controller.ts') ? [path] : [];
  });
}

const files = controllerFiles(join(__dirname, '..', '..', '..', 'src'));

const controllers = files.flatMap((file) =>
  Object.values(jest.requireActual<Record<string, unknown>>(file)).filter(
    (exported): exported is Controller =>
      typeof exported === 'function' &&
      Reflect.hasMetadata(PATH_METADATA, exported),
  ),
);

const routes = controllers.flatMap((controller) =>
  Object.getOwnPropertyNames(controller.prototype)
    .filter((name) =>
      Reflect.hasMetadata(
        METHOD_METADATA,
        controller.prototype[name] as object,
      ),
    )
    .map((name) => ({
      route: `${controller.name}.${name}`,
      controller,
      handler: controller.prototype[name] as object,
    })),
);

describe('AllowLevels', () => {
  it('should store the allowed levels in the route metadata', () => {
    class Target {
      handler() {}
    }
    AllowLevels(LEVELS.ADMIN, LEVELS.PROFISSIONAL_SAUDE)(
      Target.prototype,
      'handler',
      Object.getOwnPropertyDescriptor(Target.prototype, 'handler')!,
    );

    expect(
      Reflect.getMetadata(ALLOW_LEVELS_KEY, Target.prototype.handler),
    ).toEqual([LEVELS.ADMIN, LEVELS.PROFISSIONAL_SAUDE]);
  });

  it('should mark the route as open to any level with AllowAnyLevel', () => {
    class Target {
      handler() {}
    }
    AllowAnyLevel()(
      Target.prototype,
      'handler',
      Object.getOwnPropertyDescriptor(Target.prototype, 'handler')!,
    );

    expect(
      Reflect.getMetadata(ALLOW_LEVELS_KEY, Target.prototype.handler),
    ).toBe(ANY_LEVEL);
  });
});

// O AuthGuard nega a rota que não declara níveis. Sem este teste, a rota nova
// sem decorator só apareceria como 403 para todo usuário depois do deploy.
describe('declaração de acesso nas rotas', () => {
  it('should find every controller of the application', () => {
    expect(controllers).toHaveLength(files.length);
    expect(routes.length).toBeGreaterThan(0);
  });

  it.each(routes.map((r) => [r.route, r] as const))(
    '%s should declare @Public, @AllowLevels or @AllowAnyLevel',
    (_, { controller, handler }) => {
      const isPublic =
        Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true ||
        Reflect.getMetadata(IS_PUBLIC_KEY, controller) === true;
      const levels: unknown = Reflect.getMetadata(ALLOW_LEVELS_KEY, handler);
      const declaresLevels =
        levels === ANY_LEVEL || (Array.isArray(levels) && levels.length > 0);

      expect(isPublic || declaresLevels).toBe(true);
    },
  );

  // @Public e @AllowAnyLevel passam pela varredura acima. As listas fechadas
  // impedem que um deles, copiado para uma rota de dados, reabra o acesso.
  it('should keep @Public only on the authentication and health routes', () => {
    const publicRoutes = routes
      .filter(
        ({ controller, handler }) =>
          Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true ||
          Reflect.getMetadata(IS_PUBLIC_KEY, controller) === true,
      )
      .map(({ route }) => route)
      .sort();

    expect(publicRoutes).toEqual([
      'AppController.getHello',
      'AuthController.activateAccount',
      'AuthController.forgotPassword',
      'AuthController.getGoogleConfig',
      'AuthController.resetPassword',
      'AuthController.signIn',
      'AuthController.signInWithGoogle',
      'AuthController.verifyResetCode',
    ]);
  });

  it('should open to any level only the routes of the session account', () => {
    const anyLevelRoutes = routes
      .filter(
        ({ handler }) =>
          Reflect.getMetadata(ALLOW_LEVELS_KEY, handler) === ANY_LEVEL,
      )
      .map(({ route }) => route)
      .sort();

    expect(anyLevelRoutes).toEqual([
      'AuthController.completeRegistration',
      'AuthController.getGoogleLinkStatus',
      'AuthController.getProfile',
      'AuthController.linkGoogleAccount',
      'AuthController.logout',
      'AuthController.unlinkGoogleAccount',
      'AuthController.updateMe',
    ]);
  });
});
