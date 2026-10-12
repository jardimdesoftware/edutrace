import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { PrismaService } from './database/prisma.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard';
import { ConfigModule } from '@nestjs/config';
import { StudentsModule } from './students/students.module';
import { LevelsModule } from './levels/levels.module';
import { ScreeningsModule } from './screenings/screenings.module';
import { PhasesModule } from './phases/phases.module';
import { AnamnesisModule } from './anamnesis/anamnesis.module';
import { CommentsModule } from './comments/comments.module';
import { PlansEducationModule } from './plans-education/plans-education.module';
import { ReportsModule } from './reports/reports.module';
import { SessionsModule } from './sessions/sessions.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { UserThrottlerGuard } from './common/user-throttler.guard';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    ConfigModule.forRoot({ isGlobal: true }),
    StudentsModule,
    LevelsModule,
    ScreeningsModule,
    PhasesModule,
    AnamnesisModule,
    CommentsModule,
    PlansEducationModule,
    ReportsModule,
    SessionsModule,
    // Limite de requisições de cada usuário em cada rota, contra a repetição
    // automatizada de chamadas e a varredura das consultas por chave. As rotas
    // públicas de autenticação têm limite próprio (@Throttle em
    // AuthController). API_RATE_LIMIT e API_RATE_LIMIT_TTL_MS substituem o
    // limite e a janela, por exemplo para testes de carga.
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: Number(process.env.API_RATE_LIMIT_TTL_MS) || 60_000,
        limit: Number(process.env.API_RATE_LIMIT) || 300,
      },
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    // A ordem importa: o AuthGuard preenche request.user antes da contagem
    // por usuário do UserThrottlerGuard.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
  ],
  exports: [AppService],
})
export class AppModule {}
