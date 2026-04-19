import { Controller, Get } from '@nestjs/common';
import { SystemIntegrationsService } from './system-integrations.service';

@Controller('platform/about')
export class PlatformAboutController {
  constructor(
    private readonly systemIntegrationsService: SystemIntegrationsService,
  ) {}

  @Get()
  getAboutContent() {
    return this.systemIntegrationsService.getPlatformContent();
  }
}
