import { Module } from '@nestjs/common';
import { SystemIntegrationsModule } from '../system-integrations/system-integrations.module';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';

@Module({
  imports: [SystemIntegrationsModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
