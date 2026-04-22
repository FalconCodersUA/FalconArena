import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs.module';
import { StorageModule } from '../storage/storage.module';
import { PlatformAboutController } from './platform-about.controller';
import { PlatformDefaultsController } from './platform-defaults.controller';
import { PlatformReviewsService } from './platform-reviews.service';
import { SystemIntegrationsController } from './system-integrations.controller';
import { SystemIntegrationsService } from './system-integrations.service';

@Module({
  imports: [AuditLogsModule, StorageModule],
  controllers: [
    SystemIntegrationsController,
    PlatformDefaultsController,
    PlatformAboutController,
  ],
  providers: [SystemIntegrationsService, PlatformReviewsService],
  exports: [SystemIntegrationsService],
})
export class SystemIntegrationsModule {}
