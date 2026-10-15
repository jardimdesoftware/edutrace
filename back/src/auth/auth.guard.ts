import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { IS_PUBLIC_KEY, jwtConstants } from './constants/constants';
import { ALLOW_PASSWORD_CHANGE_KEY } from './decorators/allow-password-change.decorator';
import { ALLOW_INCOMPLETE_REGISTRATION_KEY } from './decorators/allow-incomplete-registration.decorator';
import {
  ALLOW_LEVELS_KEY,
  ANY_LEVEL,
} from './decorators/allow-levels.decorator';
import { SessionsService } from 'src/sessions/sessions.service';
import { sessionCookieName } from 'src/common/session-cookie';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    private sessionsService: SessionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: jwtConstants.secret,
      });

      // A assinatura sozinha não diz se a sessão ainda vale: token de sessão
      // revogada, por logout ou por login em outro lugar, continua com
      // assinatura válida até vencer.
      const session = await this.sessionsService.findActive(payload.jti);

      // O token precisa ser do dono da sessão, e o nível vem do banco. Assim,
      // um token reassinado com outro sub ou outro id_level não passa, e a
      // troca de nível vale na requisição seguinte (ASVS 5.0, 8.3.2).
      if (!session || session.id_user !== payload.sub) {
        throw new UnauthorizedException('Sessão encerrada');
      }

      await this.sessionsService.registerUse(session);

      const user = { ...payload, id_level: session.user.id_level };
      request['user'] = user;

      // Enquanto a troca do primeiro acesso não acontece, o token só abre as
      // rotas necessárias para realizá-la. Sem isto a obrigatoriedade existiria
      // apenas na interface e seria contornada chamando a API diretamente.
      const allowsPasswordChange = this.reflector.get<boolean>(
        ALLOW_PASSWORD_CHANGE_KEY,
        context.getHandler(),
      );

      if (payload.must_change_password && !allowsPasswordChange) {
        throw new ForbiddenException(
          'Defina uma nova senha antes de continuar.',
        );
      }

      // Conta criada pelo login com Google sem CPF nem senha cadastrados: o
      // token só abre as rotas necessárias para concluir o cadastro.
      const allowsIncompleteRegistration = this.reflector.get<boolean>(
        ALLOW_INCOMPLETE_REGISTRATION_KEY,
        context.getHandler(),
      );

      if (payload.must_complete_registration && !allowsIncompleteRegistration) {
        throw new ForbiddenException(
          'Cadastre o CPF e a senha antes de continuar.',
        );
      }

      // Nega por padrão: a rota sem níveis declarados fica fechada, para que
      // esquecer o decorator numa rota nova não a abra a todo usuário logado.
      const allowedLevels = this.reflector.get<
        readonly number[] | typeof ANY_LEVEL | undefined
      >(ALLOW_LEVELS_KEY, context.getHandler());

      if (
        allowedLevels !== ANY_LEVEL &&
        !allowedLevels?.includes(user.id_level)
      ) {
        throw new ForbiddenException('Nível de acesso insuficiente');
      }
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new UnauthorizedException('Token expirado');
    }
    return true;
  }

  // O navegador envia o token no cookie HttpOnly. O Bearer continua aceito para
  // quem não é navegador: o middleware do Next, que repassa o cookie ao
  // verificar a sessão, e os testes de carga.
  private extractToken(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, string> | undefined;
    const fromCookie = cookies?.[sessionCookieName()];
    if (fromCookie) {
      return fromCookie;
    }

    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
