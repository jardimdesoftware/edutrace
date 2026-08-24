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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AppService],
})
export class AppModule {}
