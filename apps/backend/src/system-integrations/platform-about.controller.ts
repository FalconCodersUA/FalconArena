import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CreatePlatformReviewDto } from './dto/create-platform-review.dto';
import { PlatformReviewsService } from './platform-reviews.service';
import { SystemIntegrationsService } from './system-integrations.service';

@Controller('platform/about')
export class PlatformAboutController {
  constructor(
    private readonly systemIntegrationsService: SystemIntegrationsService,
    private readonly platformReviewsService: PlatformReviewsService,
  ) {}

  @Get()
  getAboutContent() {
    return this.systemIntegrationsService.getPlatformContent();
  }

  @Get('reviews')
  listReviews() {
    return this.platformReviewsService.listPublicReviews();
  }

  @Post('reviews')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({
    bucket: 'platform-review-submit',
    limit: 5,
    windowSeconds: 300,
    keyStrategy: 'user',
  })
  submitReview(
    @Body() dto: CreatePlatformReviewDto,
    @Req() request: { user: AuthUser },
  ) {
    return this.platformReviewsService.submitReview(dto, request.user);
  }
}
