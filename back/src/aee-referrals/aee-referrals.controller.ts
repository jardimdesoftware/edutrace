import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
} from '@nestjs/common';
import { AllowLevels } from 'src/auth/decorators/allow-levels.decorator';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { LEVELS } from 'src/constants';
import { AeeReferralsService } from './aee-referrals.service';
import { MarkSeenDto } from './dto/mark-seen.dto';
import { ReferStudentDto } from './dto/refer-student.dto';

@Controller('aee-referrals')
export class AeeReferralsController {
  constructor(private readonly aeeReferralsService: AeeReferralsService) {}

  // Quem encaminha é quem está na sessão, e não um campo do corpo.
  @AllowLevels(LEVELS.PROFISSIONAL_NAPNE)
  @Post()
  refer(
    @Body() dto: ReferStudentDto,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.aeeReferralsService.refer(dto.student_email, dto.teacher_id, {
      sub: request.user.sub,
      name: request.user.name,
    });
  }

  @AllowLevels(LEVELS.PROFESSOR_AEE)
  @Get('notifications')
  pending(@Request() request: AuthenticatedRequest) {
    return this.aeeReferralsService.pending(request.user.sub);
  }

  @AllowLevels(LEVELS.PROFESSOR_AEE)
  @HttpCode(HttpStatus.OK)
  @Post('notifications/seen')
  markSeen(@Body() dto: MarkSeenDto, @Request() request: AuthenticatedRequest) {
    return this.aeeReferralsService.markSeen(request.user.sub, dto.ids);
  }
}
