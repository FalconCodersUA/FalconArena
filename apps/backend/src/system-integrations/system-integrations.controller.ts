import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { TestGoogleSheetsConnectionDto } from './dto/test-google-sheets-connection.dto';
import { UpdateGoogleSheetsSettingsDto } from './dto/update-google-sheets-settings.dto';
import { SystemIntegrationsService } from './system-integrations.service';

@Controller('admin/system-integrations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SystemIntegrationsController {
  constructor(
    private readonly systemIntegrationsService: SystemIntegrationsService,
  ) {}

  @Get('google-sheets')
  getGoogleSheetsSettings() {
    return this.systemIntegrationsService.getGoogleSheetsSettings();
  }

  @Patch('google-sheets')
  updateGoogleSheetsSettings(
    @Body() dto: UpdateGoogleSheetsSettingsDto,
    @Req() request: { user: AuthUser },
  ) {
    return this.systemIntegrationsService.updateGoogleSheetsSettings(
      dto,
      request.user.userId,
    );
  }

  @Post('google-sheets/test')
  testGoogleSheetsConnection(
    @Body() dto: TestGoogleSheetsConnectionDto,
    @Req() request: { user: AuthUser },
  ) {
    return this.systemIntegrationsService.testGoogleSheetsConnection(dto, request.user);
  }
}
