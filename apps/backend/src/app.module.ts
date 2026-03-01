import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { TeamsModule } from './teams/teams.module';
import { TournamentsModule } from './tournaments/tournaments.module';

@Module({
  imports: [PrismaModule, AuthModule, TournamentsModule, TeamsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
