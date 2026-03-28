import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
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
  ) {
    return this.tournamentScheduleService.create(tournamentId, dto);
  }

  @Patch(':eventId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ORGANIZER')
  update(
    @Param('tournamentId') tournamentId: string,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateTournamentScheduleEventDto,
  ) {
    return this.tournamentScheduleService.update(tournamentId, eventId, dto);
  }

  @Delete(':eventId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ORGANIZER')
  remove(
    @Param('tournamentId') tournamentId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.tournamentScheduleService.remove(tournamentId, eventId);
  }
}
