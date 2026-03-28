import { Controller, Get, Param, Res } from '@nestjs/common';
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
}
