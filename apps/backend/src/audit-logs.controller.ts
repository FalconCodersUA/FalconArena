import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from './common/decorators/roles.decorator';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthUser } from './common/types/auth-user.type';
import { AuditLogsService } from './audit-logs.service';

@Controller('activity')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get('mine')
  listMine(
    @Req() request: { user: AuthUser },
    @Query('limit') limit?: string,
  ) {
    return this.auditLogsService.listPersonalActivity(
      request.user.userId,
      this.toLimit(limit),
    );
  }

  @Get('admin')
  @Roles('ADMIN', 'ORGANIZER')
  listAdminActivity(
    @Query('limit') limit?: string,
    @Query('tournamentId') tournamentId?: string,
  ) {
    return this.auditLogsService.listRecentSystemActivity(
      this.toLimit(limit),
      tournamentId,
    );
  }

  private toLimit(value?: string) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 10;
    }

    return Math.min(Math.max(Math.trunc(numeric), 1), 25);
  }
}
