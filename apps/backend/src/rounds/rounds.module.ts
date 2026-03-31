import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs.module';
import { JobsModule } from '../jobs/jobs.module';
import { NotificationsModule } from '../notifications.module';
import { RoundsController } from './rounds.controller';
import { RoundsService } from './rounds.service';

@Module({
  imports: [AuditLogsModule, NotificationsModule, JobsModule],
  controllers: [RoundsController],
  providers: [RoundsService],
  exports: [RoundsService],
})
export class RoundsModule {}
