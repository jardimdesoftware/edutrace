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

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
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
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: jwtConstants.secret,
      });

      request['user'] = payload;

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

      const requiredLevels =
        this.reflector.get<number[]>('levels', context.getHandler()) || [];

      if (
        requiredLevels.length > 0 &&
        requiredLevels.includes(payload.id_level)
      ) {
        throw new UnauthorizedException('Nível de acesso insuficiente');
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

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
