import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from './common/decorators/roles.decorator';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthUser } from './common/types/auth-user.type';
import { DashboardMetricsService } from './dashboard-metrics.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardMetricsController {
  constructor(private readonly dashboardMetricsService: DashboardMetricsService) {}

  @Get('admin/metrics')
  @Roles('ADMIN', 'ORGANIZER')
  getAdminMetrics(@Query('tournamentId') tournamentId?: string) {
    return this.dashboardMetricsService.getAdminMetrics(tournamentId);
  }

  @Get('jury/metrics')
  @Roles('JURY')
  getJuryMetrics(
    @Req() request: { user: AuthUser },
    @Query('tournamentId') tournamentId?: string,
    @Query('roundId') roundId?: string,
  ) {
    return this.dashboardMetricsService.getJuryMetrics(
      request.user.userId,
      tournamentId,
      roundId,
    );
  }

  @Get('team/metrics')
  @Roles('TEAM')
  getTeamMetrics(
    @Req() request: { user: AuthUser },
    @Query('tournamentId') tournamentId?: string,
  ) {
    return this.dashboardMetricsService.getTeamMetrics(
      request.user.userId,
      tournamentId,
    );
  }
}

