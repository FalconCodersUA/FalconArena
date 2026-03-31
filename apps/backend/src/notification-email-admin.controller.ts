import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { RateLimit } from './common/decorators/rate-limit.decorator';
import { Roles } from './common/decorators/roles.decorator';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { NotificationEmailService } from './notification-email.service';
import { TestEmailDeliveryDto } from './system-integrations/dto/test-email-delivery.dto';

@Controller('admin/system-integrations/email')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class NotificationEmailAdminController {
  constructor(
    private readonly notificationEmailService: NotificationEmailService,
  ) {}

  @Post('test')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    bucket: 'system-integrations-email-test',
    limit: 10,
    windowSeconds: 60,
    keyStrategy: 'user',
  })
  testEmailDelivery(@Body() dto: TestEmailDeliveryDto) {
    return this.notificationEmailService.sendTestEmail(dto.recipientEmail);
  }
}
