import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersPurgeService } from './users-purge.service';
import { UsersController } from './users.controller';
import { PrismaService } from 'src/database/prisma.service';
import { SessionsModule } from 'src/sessions/sessions.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [SessionsModule, MailModule],
  controllers: [UsersController],
  providers: [UsersService, UsersPurgeService, PrismaService],
  exports: [UsersService],
})
export class UsersModule {}
