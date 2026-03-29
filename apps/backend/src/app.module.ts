import { Module } from '@nestjs/common';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DashboardMetricsController } from './dashboard-metrics.controller';
import { DashboardMetricsService } from './dashboard-metrics.service';
import { DirectMessagesController } from './direct-messages.controller';
import { DirectMessagesService } from './direct-messages.service';
import { EvaluationModule } from './evaluation/evaluation.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { NotificationsModule } from './notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileSettingsController } from './profile-settings.controller';
import { ProfileSettingsService } from './profile-settings.service';
import { RoundsModule } from './rounds/rounds.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { SystemIntegrationsModule } from './system-integrations/system-integrations.module';
import { TeamsModule } from './teams/teams.module';
import { TournamentsModule } from './tournaments/tournaments.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    NotificationsModule,
    TournamentsModule,
    TeamsModule,
    RoundsModule,
    SubmissionsModule,
    EvaluationModule,
    LeaderboardModule,
    SystemIntegrationsModule,
  ],
  controllers: [
    AppController,
    DashboardMetricsController,
    ProfileSettingsController,
    AnnouncementsController,
    DirectMessagesController,
  ],
  providers: [
    AppService,
    DashboardMetricsService,
    ProfileSettingsService,
    AnnouncementsService,
    DirectMessagesService,
  ],
})
export class AppModule {}
