import { Controller, Get } from '@nestjs/common';
import { SystemIntegrationsService } from './system-integrations.service';

@Controller('platform/defaults')
export class PlatformDefaultsController {
  constructor(
    private readonly systemIntegrationsService: SystemIntegrationsService,
  ) {}

  @Get()
  getDefaults() {
    return this.systemIntegrationsService.getPublicTournamentDefaults();
  }
}
