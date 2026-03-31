import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import {
  CreateTournamentScheduleEventDto,
  UpdateTournamentScheduleEventDto,
} from './dto/tournament-schedule.dto';
import { TournamentScheduleService } from './tournament-schedule.service';

@Controller('tournaments/:tournamentId/schedule')
export class TournamentScheduleController {
  constructor(
    private readonly tournamentScheduleService: TournamentScheduleService,
  ) {}

  @Get()
  list(@Param('tournamentId') tournamentId: string) {
    return this.tournamentScheduleService.list(tournamentId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ORGANIZER')
  create(
    @Param('tournamentId') tournamentId: string,
    @Body() dto: CreateTournamentScheduleEventDto,
    @Req() request: { user: AuthUser },
  ) {
    return this.tournamentScheduleService.create(tournamentId, dto, request.user);
  }

  @Patch(':eventId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ORGANIZER')
  update(
    @Param('tournamentId') tournamentId: string,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateTournamentScheduleEventDto,
    @Req() request: { user: AuthUser },
  ) {
    return this.tournamentScheduleService.update(
      tournamentId,
      eventId,
      dto,
      request.user,
    );
  }

  @Delete(':eventId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ORGANIZER')
  remove(
    @Param('tournamentId') tournamentId: string,
    @Param('eventId') eventId: string,
    @Req() request: { user: AuthUser },
  ) {
    return this.tournamentScheduleService.remove(
      tournamentId,
      eventId,
      request.user,
    );
  }
}
