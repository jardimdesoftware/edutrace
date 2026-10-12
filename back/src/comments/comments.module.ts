import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { PrismaService } from 'src/database/prisma.service';
import { MailModule } from 'src/mail/mail.module';
import { StudentsModule } from 'src/students/students.module';

@Module({
  imports: [MailModule, StudentsModule],
  controllers: [CommentsController],
  providers: [CommentsService, PrismaService],
  exports: [CommentsService],
})
export class CommentsModule {}
