import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CertificateQueryDto } from './dto/certificate-query.dto';
import { UpsertCertificateTemplateDto } from './dto/upsert-certificate-template.dto';
import { TournamentCertificatesService } from './tournament-certificates.service';

@Controller('tournaments/:tournamentId')
export class TournamentCertificatesController {
  constructor(
    private readonly tournamentCertificatesService: TournamentCertificatesService,
  ) {}

  @Get('certificate-template')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ORGANIZER')
  getTemplate(@Param('tournamentId') tournamentId: string) {
    return this.tournamentCertificatesService.getTemplate(tournamentId);
  }

  @Patch('certificate-template')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ORGANIZER')
  upsertTemplate(
    @Param('tournamentId') tournamentId: string,
    @Body() dto: UpsertCertificateTemplateDto,
  ) {
    return this.tournamentCertificatesService.upsertTemplate(tournamentId, dto);
  }

  @Get('certificates/teams/:teamId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ORGANIZER')
  getTeamCertificate(
    @Param('tournamentId') tournamentId: string,
    @Param('teamId') teamId: string,
    @Query() query: CertificateQueryDto,
  ) {
    return this.tournamentCertificatesService.getTeamCertificate(
      tournamentId,
      teamId,
      query.kind ?? 'participation',
    );
  }
}
