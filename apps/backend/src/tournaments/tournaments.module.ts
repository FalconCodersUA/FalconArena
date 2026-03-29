import { Module } from '@nestjs/common';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { NotificationsModule } from '../notifications.module';
import { SystemIntegrationsModule } from '../system-integrations/system-integrations.module';
import { TournamentCertificatesController } from './tournament-certificates.controller';
import { TournamentCertificatesService } from './tournament-certificates.service';
import { TournamentScheduleController } from './tournament-schedule.controller';
import { TournamentScheduleService } from './tournament-schedule.service';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';

@Module({
  imports: [LeaderboardModule, NotificationsModule, SystemIntegrationsModule],
  controllers: [
    TournamentsController,
    TournamentScheduleController,
    TournamentCertificatesController,
  ],
  providers: [
    TournamentsService,
    TournamentScheduleService,
    TournamentCertificatesService,
  ],
  exports: [TournamentsService],
})
export class TournamentsModule {}
