import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs.module';
import { NotificationsModule } from '../notifications.module';
import { RoundsModule } from '../rounds/rounds.module';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

@Module({
  imports: [AuditLogsModule, RoundsModule, NotificationsModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
