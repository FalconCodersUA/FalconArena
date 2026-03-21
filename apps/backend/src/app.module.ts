import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DashboardMetricsController } from './dashboard-metrics.controller';
import { DashboardMetricsService } from './dashboard-metrics.service';
import { EvaluationModule } from './evaluation/evaluation.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileSettingsController } from './profile-settings.controller';
import { ProfileSettingsService } from './profile-settings.service';
import { RoundsModule } from './rounds/rounds.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { TeamsModule } from './teams/teams.module';
import { TournamentsModule } from './tournaments/tournaments.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    TournamentsModule,
    TeamsModule,
    RoundsModule,
    SubmissionsModule,
    EvaluationModule,
    LeaderboardModule,
  ],
  controllers: [AppController, DashboardMetricsController, ProfileSettingsController],
  providers: [AppService, DashboardMetricsService, ProfileSettingsService],
})
export class AppModule {}
