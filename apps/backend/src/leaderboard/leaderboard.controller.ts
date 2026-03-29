import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { ExportGoogleSheetsDto } from './dto/export-google-sheets.dto';
import { LeaderboardService } from './leaderboard.service';

@Controller('tournaments/:tournamentId/leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  getTournamentLeaderboard(@Param('tournamentId') tournamentId: string) {
    return this.leaderboardService.getTournamentLeaderboard(tournamentId);
  }

  @Get('export.csv')
  async exportTournamentLeaderboardCsv(
    @Param('tournamentId') tournamentId: string,
    @Res({ passthrough: true })
    response: {
      setHeader(name: string, value: string): void;
    },
  ) {
    const csv = await this.leaderboardService.exportTournamentLeaderboardCsv(
      tournamentId,
    );

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="leaderboard-${tournamentId}.csv"`,
    );

    return csv;
  }

  @Post('export.google-sheets')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ORGANIZER')
  exportTournamentLeaderboardGoogleSheets(
    @Param('tournamentId') tournamentId: string,
    @Body() dto: ExportGoogleSheetsDto,
    @Req() request: { user: AuthUser },
  ) {
    return this.leaderboardService.exportTournamentLeaderboardToGoogleSheets(
      tournamentId,
      {
        sheetName: dto.sheetName,
        exportedBy: {
          userId: request.user.userId,
          email: request.user.email,
          role: request.user.role,
        },
      },
    );
  }
}
