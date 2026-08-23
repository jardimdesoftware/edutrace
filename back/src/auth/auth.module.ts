import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module';
import { MailModule } from 'src/mail/mail.module';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './constants/constants';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    UsersModule,
    MailModule,
    // Camada complementar ao bloqueio por conta, aplicada apenas nas rotas
    // públicas de autenticação (ver AuthController). O teto é folgado porque
    // uma escola inteira atrás de NAT sai com um único IP público, e é
    // configurável para que testes de carga possam elevá-lo no ambiente deles.
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.AUTH_RATE_LIMIT_TTL_MS) || 60_000,
        limit: Number(process.env.AUTH_RATE_LIMIT) || 20,
      },
    ]),
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
