import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';

// Intervalo mínimo entre duas gravações de last_used_at da mesma sessão. Sem
// ele o campo custaria uma escrita a cada requisição autenticada.
const LAST_USED_REFRESH_MS = 60 * 1000;

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    jti: string;
    id_user: number;
    ip?: string | null;
    user_agent?: string | null;
  }) {
    return this.prisma.session.create({
      data: {
        jti: data.jti,
        id_user: data.id_user,
        ip: data.ip ?? null,
        user_agent: data.user_agent ?? null,
      },
    });
  }

  async findActive(jti: string) {
    return this.prisma.session.findFirst({
      where: { jti: jti, revoked_at: null },
    });
  }

  async revokeByJti(jti: string) {
    return this.prisma.session.updateMany({
      where: { jti: jti, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  async revokeAllFromUser(id_user: number) {
    return this.prisma.session.updateMany({
      where: { id_user: id_user, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  async registerUse(session: { id: number; last_used_at: Date }) {
    const desde = Date.now() - session.last_used_at.getTime();

    if (desde < LAST_USED_REFRESH_MS) {
      return;
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { last_used_at: new Date() },
    });
  }
}
