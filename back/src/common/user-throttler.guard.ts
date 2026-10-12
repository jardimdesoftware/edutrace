import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// Conta as requisições pelo usuário da sessão, preenchido pelo AuthGuard, que
// por isso precisa ser registrado antes deste guard. Uma escola inteira atrás
// de NAT sai com um único IP público, e a contagem por IP faria todos os
// usuários da escola dividirem o mesmo limite. Sem sessão, a contagem continua
// por IP.
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const sub = (req.user as { sub?: number } | undefined)?.sub;
    return sub ? `user:${sub}` : super.getTracker(req);
  }
}
