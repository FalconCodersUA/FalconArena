import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { ListTournamentsDto } from './dto/list-tournaments.dto';
import { UpdateTournamentJuryDto } from './dto/update-tournament-jury.dto';
import { UpdateTournamentStatusDto } from './dto/update-tournament-status.dto';
import { TournamentsService } from './tournaments.service';

@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ORGANIZER')
  create(
    @Body() dto: CreateTournamentDto,
    @Req() request: { user: AuthUser },
  ) {
    return this.tournamentsService.create(dto, request.user);
  }

  @Get()
  list(@Query() query: ListTournamentsDto) {
    return this.tournamentsService.list(query);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.tournamentsService.findById(id);
  }

  @Get(':id/archive')
  getArchive(@Param('id') id: string) {
    return this.tournamentsService.getArchive(id);
  }

  @Get(':id/jury')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ORGANIZER')
  getJury(@Param('id') id: string) {
    return this.tournamentsService.getTournamentJury(id);
  }

  @Patch(':id/jury')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ORGANIZER')
  updateJury(
    @Param('id') id: string,
    @Body() dto: UpdateTournamentJuryDto,
    @Req() request: { user: AuthUser },
  ) {
    return this.tournamentsService.updateTournamentJury(id, dto.juryUserIds, request.user);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ORGANIZER')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTournamentStatusDto,
    @Req() request: { user: AuthUser },
  ) {
    return this.tournamentsService.updateStatus(id, dto.status, request.user);
  }
}
