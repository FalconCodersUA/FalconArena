import { Module } from '@nestjs/common';
import { SystemIntegrationsModule } from '../system-integrations/system-integrations.module';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [SystemIntegrationsModule],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
