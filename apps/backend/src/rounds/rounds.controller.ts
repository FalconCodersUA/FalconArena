import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateRoundDto } from './dto/create-round.dto';
import { UpdateRoundStatusDto } from './dto/update-round-status.dto';
import { RoundsService } from './rounds.service';

@Controller('tournaments/:tournamentId/rounds')
export class RoundsController {
  constructor(private readonly roundsService: RoundsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ORGANIZER')
  create(
    @Param('tournamentId') tournamentId: string,
    @Body() dto: CreateRoundDto,
  ) {
    return this.roundsService.create(tournamentId, dto);
  }

  @Get()
  list(@Param('tournamentId') tournamentId: string) {
    return this.roundsService.listByTournament(tournamentId);
  }

  @Get('active')
  active(@Param('tournamentId') tournamentId: string) {
    return this.roundsService.getActiveRound(tournamentId);
  }

  @Patch(':roundId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ORGANIZER')
  updateStatus(
    @Param('tournamentId') tournamentId: string,
    @Param('roundId') roundId: string,
    @Body() dto: UpdateRoundStatusDto,
  ) {
    return this.roundsService.updateStatus(tournamentId, roundId, dto.status);
  }
}
