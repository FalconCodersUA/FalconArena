import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Roles } from './common/decorators/roles.decorator';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthUser } from './common/types/auth-user.type';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  health() {
    return this.appService.health();
  }

  @Get('admin/health')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ORGANIZER')
  adminHealth(@Req() request: { user: AuthUser }) {
    return {
      ...this.appService.health(),
      scope: 'admin',
      userId: request.user.userId,
      role: request.user.role,
    };
  }
}
