import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { RegisterTeamDto } from './dto/register-team.dto';
import { TeamsService } from './teams.service';

@Controller('tournaments/:tournamentId/teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TEAM', 'ADMIN', 'ORGANIZER')
  register(
    @Param('tournamentId') tournamentId: string,
    @Req() request: { user: AuthUser },
    @Body() dto: RegisterTeamDto,
  ) {
    return this.teamsService.register(tournamentId, request.user.userId, dto);
  }

  @Get()
  list(@Param('tournamentId') tournamentId: string) {
    return this.teamsService.listByTournament(tournamentId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TEAM', 'ADMIN', 'ORGANIZER')
  getMyTeam(
    @Param('tournamentId') tournamentId: string,
    @Req() request: { user: AuthUser },
  ) {
    return this.teamsService.getMyTeam(tournamentId, request.user.userId);
  }
}

@Controller('teams')
export class TeamsDirectoryController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  listAllVisible() {
    return this.teamsService.listAllVisible();
  }
}
