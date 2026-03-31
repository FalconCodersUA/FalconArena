import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
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
  @UseGuards(RateLimitGuard)
  @RateLimit({
    bucket: 'system-integrations-update',
    limit: 10,
    windowSeconds: 60,
    keyStrategy: 'user',
  })
  updateGoogleSheetsSettings(
    @Body() dto: UpdateGoogleSheetsSettingsDto,
    @Req() request: { user: AuthUser },
  ) {
    return this.systemIntegrationsService.updateGoogleSheetsSettings(
      dto,
      request.user,
    );
  }

  @Post('google-sheets/test')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    bucket: 'system-integrations-test',
    limit: 10,
    windowSeconds: 60,
    keyStrategy: 'user',
  })
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
  @UseGuards(RateLimitGuard)
  @RateLimit({
    bucket: 'system-integrations-update',
    limit: 10,
    windowSeconds: 60,
    keyStrategy: 'user',
  })
  updateEmailSettings(
    @Body() dto: UpdateEmailSettingsDto,
    @Req() request: { user: AuthUser },
  ) {
    return this.systemIntegrationsService.updateEmailSettings(
      dto,
      request.user,
    );
  }

  @Get('notification-rules')
  getNotificationRules() {
    return this.systemIntegrationsService.getNotificationRules();
  }

  @Patch('notification-rules')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    bucket: 'system-integrations-update',
    limit: 10,
    windowSeconds: 60,
    keyStrategy: 'user',
  })
  updateNotificationRules(
    @Body() dto: UpdateNotificationRulesDto,
    @Req() request: { user: AuthUser },
  ) {
    return this.systemIntegrationsService.updateNotificationRules(
      dto,
      request.user,
    );
  }

  @Get('tournament-defaults')
  getTournamentDefaults() {
    return this.systemIntegrationsService.getTournamentDefaults();
  }

  @Patch('tournament-defaults')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    bucket: 'system-integrations-update',
    limit: 10,
    windowSeconds: 60,
    keyStrategy: 'user',
  })
  updateTournamentDefaults(
    @Body() dto: UpdateTournamentDefaultsDto,
    @Req() request: { user: AuthUser },
  ) {
    return this.systemIntegrationsService.updateTournamentDefaults(
      dto,
      request.user,
    );
  }
}
