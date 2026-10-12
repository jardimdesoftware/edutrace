import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module';
import { MailModule } from 'src/mail/mail.module';
import { JwtModule } from '@nestjs/jwt';
import { AUTH_RATE_LIMIT_DEFAULT, jwtConstants } from './constants/constants';
import { ThrottlerModule } from '@nestjs/throttler';
import { SessionsModule } from 'src/sessions/sessions.module';
import { CompromisedPasswordService } from './compromised-password.service';

@Module({
  imports: [
    UsersModule,
    MailModule,
    SessionsModule,
    // Camada complementar ao bloqueio por conta, aplicada apenas nas rotas
    // públicas de autenticação (ver AuthController). O padrão é de 8
    // requisições por minuto por IP em cada rota (AUTH_RATE_LIMIT_DEFAULT).
    // AUTH_RATE_LIMIT e AUTH_RATE_LIMIT_TTL_MS substituem o limite e a janela,
    // para elevar o teto quando uma escola inteira sai por um único IP público
    // (NAT) ou para testes de carga.
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.AUTH_RATE_LIMIT_TTL_MS) || 60_000,
        limit: Number(process.env.AUTH_RATE_LIMIT) || AUTH_RATE_LIMIT_DEFAULT,
      },
    ]),
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, CompromisedPasswordService],
})
export class AuthModule {}
