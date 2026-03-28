import { Module } from '@nestjs/common';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { TournamentScheduleController } from './tournament-schedule.controller';
import { TournamentScheduleService } from './tournament-schedule.service';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';

@Module({
  imports: [LeaderboardModule],
  controllers: [TournamentsController, TournamentScheduleController],
  providers: [TournamentsService, TournamentScheduleService],
  exports: [TournamentsService],
})
export class TournamentsModule {}
