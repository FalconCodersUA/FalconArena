import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { ListPlatformReviewsDto } from './dto/list-platform-reviews.dto';
import { TestGoogleSheetsConnectionDto } from './dto/test-google-sheets-connection.dto';
import { UpdateEmailSettingsDto } from './dto/update-email-settings.dto';
import { UpdateGoogleSheetsSettingsDto } from './dto/update-google-sheets-settings.dto';
import { UpdateNotificationRulesDto } from './dto/update-notification-rules.dto';
import { UpdatePlatformContentDto } from './dto/update-platform-content.dto';
import { UpdatePlatformReviewStatusDto } from './dto/update-platform-review-status.dto';
import { UpdateTournamentDefaultsDto } from './dto/update-tournament-defaults.dto';
import { PlatformReviewsService } from './platform-reviews.service';
import { SystemIntegrationsService } from './system-integrations.service';

type UploadedPlatformContentBannerFile = {
  buffer?: Buffer;
  mimetype?: string;
  size?: number;
};

@Controller('admin/system-integrations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SystemIntegrationsController {
  constructor(
    private readonly systemIntegrationsService: SystemIntegrationsService,
    private readonly platformReviewsService: PlatformReviewsService,
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

  @Get('platform-content')
  getPlatformContent() {
    return this.systemIntegrationsService.getPlatformContent();
  }

  @Patch('platform-content')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    bucket: 'system-integrations-update',
    limit: 10,
    windowSeconds: 60,
    keyStrategy: 'user',
  })
  updatePlatformContent(
    @Body() dto: UpdatePlatformContentDto,
    @Req() request: { user: AuthUser },
  ) {
    return this.systemIntegrationsService.updatePlatformContent(
      dto,
      request.user,
    );
  }

  @Post('platform-content/banner')
  @UseGuards(RateLimitGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  @RateLimit({
    bucket: 'system-integrations-upload',
    limit: 10,
    windowSeconds: 60,
    keyStrategy: 'user',
  })
  uploadPlatformContentBanner(
    @UploadedFile() file: UploadedPlatformContentBannerFile | undefined,
    @Req() request: { user: AuthUser },
  ) {
    return this.systemIntegrationsService.uploadPlatformContentBanner(
      file,
      request.user,
    );
  }

  @Get('platform-reviews')
  listPlatformReviews(@Query() query: ListPlatformReviewsDto) {
    return this.platformReviewsService.listAdminReviews(query);
  }

  @Patch('platform-reviews/:reviewId')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    bucket: 'platform-review-moderation',
    limit: 30,
    windowSeconds: 60,
    keyStrategy: 'user',
  })
  moderatePlatformReview(
    @Param('reviewId') reviewId: string,
    @Body() dto: UpdatePlatformReviewStatusDto,
    @Req() request: { user: AuthUser },
  ) {
    return this.platformReviewsService.moderateReview(
      reviewId,
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
