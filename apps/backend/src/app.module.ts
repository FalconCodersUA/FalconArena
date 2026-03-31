import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditLogsModule } from './audit-logs.module';
import { AuthModule } from './auth/auth.module';
import { DashboardMetricsController } from './dashboard-metrics.controller';
import { DashboardMetricsService } from './dashboard-metrics.service';
import { DirectMessagesController } from './direct-messages.controller';
import { DirectMessagesService } from './direct-messages.service';
import { EvaluationModule } from './evaluation/evaluation.module';
import { HttpLoggingInterceptor } from './http-logging.interceptor';
import { HttpRequestIdMiddleware } from './http-request-id.middleware';
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
    AuditLogsModule,
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
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpRequestIdMiddleware).forRoutes('*');
  }
}
