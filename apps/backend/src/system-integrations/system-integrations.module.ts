import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs.module';
import { PlatformDefaultsController } from './platform-defaults.controller';
import { SystemIntegrationsController } from './system-integrations.controller';
import { SystemIntegrationsService } from './system-integrations.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [SystemIntegrationsController, PlatformDefaultsController],
  providers: [SystemIntegrationsService],
  exports: [SystemIntegrationsService],
})
export class SystemIntegrationsModule {}
