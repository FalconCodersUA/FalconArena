import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuthUser } from './common/types/auth-user.type';
import { MarkNotificationsReadDto } from './notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Req() request: { user: AuthUser }) {
    return this.notificationsService.listForUser(
      request.user.userId,
      request.user.role,
    );
  }

  @Patch('read-state')
  markAsRead(
    @Req() request: { user: AuthUser },
    @Body() dto: MarkNotificationsReadDto,
  ) {
    return this.notificationsService.markAsRead(
      request.user.userId,
      dto.notificationIds,
    );
  }
}
