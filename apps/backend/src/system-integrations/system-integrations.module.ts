import { Module } from '@nestjs/common';
import { SystemIntegrationsController } from './system-integrations.controller';
import { SystemIntegrationsService } from './system-integrations.service';

@Module({
  controllers: [SystemIntegrationsController],
  providers: [SystemIntegrationsService],
  exports: [SystemIntegrationsService],
})
export class SystemIntegrationsModule {}
