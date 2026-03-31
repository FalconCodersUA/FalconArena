import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications.module';
import { JobsService } from './jobs.service';

@Module({
  imports: [NotificationsModule],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
