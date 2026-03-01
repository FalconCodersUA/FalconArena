import { Controller, Get, Param } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';

@Controller('tournaments/:tournamentId/leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  getTournamentLeaderboard(@Param('tournamentId') tournamentId: string) {
    return this.leaderboardService.getTournamentLeaderboard(tournamentId);
  }
}
