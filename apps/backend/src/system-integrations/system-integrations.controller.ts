import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { TestGoogleSheetsConnectionDto } from './dto/test-google-sheets-connection.dto';
import { UpdateEmailSettingsDto } from './dto/update-email-settings.dto';
import { UpdateGoogleSheetsSettingsDto } from './dto/update-google-sheets-settings.dto';
import { UpdateNotificationRulesDto } from './dto/update-notification-rules.dto';
import { UpdateTournamentDefaultsDto } from './dto/update-tournament-defaults.dto';
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

  @Get('email')
  getEmailSettings() {
    return this.systemIntegrationsService.getEmailSettings();
  }

  @Patch('email')
  updateEmailSettings(
    @Body() dto: UpdateEmailSettingsDto,
    @Req() request: { user: AuthUser },
  ) {
    return this.systemIntegrationsService.updateEmailSettings(
      dto,
      request.user.userId,
    );
  }

  @Get('notification-rules')
  getNotificationRules() {
    return this.systemIntegrationsService.getNotificationRules();
  }

  @Patch('notification-rules')
  updateNotificationRules(
    @Body() dto: UpdateNotificationRulesDto,
    @Req() request: { user: AuthUser },
  ) {
    return this.systemIntegrationsService.updateNotificationRules(
      dto,
      request.user.userId,
    );
  }

  @Get('tournament-defaults')
  getTournamentDefaults() {
    return this.systemIntegrationsService.getTournamentDefaults();
  }

  @Patch('tournament-defaults')
  updateTournamentDefaults(
    @Body() dto: UpdateTournamentDefaultsDto,
    @Req() request: { user: AuthUser },
  ) {
    return this.systemIntegrationsService.updateTournamentDefaults(
      dto,
      request.user.userId,
    );
  }
}
