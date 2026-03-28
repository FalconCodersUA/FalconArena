import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications.module';
import { RoundsModule } from '../rounds/rounds.module';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

@Module({
  imports: [RoundsModule, NotificationsModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
