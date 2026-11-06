import { Module } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { AeeReferralsController } from './aee-referrals.controller';
import { AeeReferralsService } from './aee-referrals.service';

@Module({
  controllers: [AeeReferralsController],
  providers: [AeeReferralsService, PrismaService],
})
export class AeeReferralsModule {}
