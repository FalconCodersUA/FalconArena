import { Module } from '@nestjs/common';
import { NotificationEmailAdminController } from './notification-email-admin.controller';
import { NotificationEmailService } from './notification-email.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SystemIntegrationsModule } from './system-integrations/system-integrations.module';

@Module({
  imports: [SystemIntegrationsModule],
  controllers: [NotificationsController, NotificationEmailAdminController],
  providers: [NotificationsService, NotificationEmailService],
  exports: [NotificationsService, NotificationEmailService],
})
export class NotificationsModule {}
