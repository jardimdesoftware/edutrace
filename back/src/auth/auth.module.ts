import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module';
import { MailModule } from 'src/mail/mail.module';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './constants/constants';
import { SessionsModule } from 'src/sessions/sessions.module';
import { CompromisedPasswordService } from './compromised-password.service';

@Module({
  imports: [
    UsersModule,
    MailModule,
    SessionsModule,
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
