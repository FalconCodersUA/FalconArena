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
import { UpsertSubmissionDto } from './dto/upsert-submission.dto';
import { SubmissionsService } from './submissions.service';

@Controller('rounds/:roundId/submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TEAM')
  upsertMySubmission(
    @Param('roundId') roundId: string,
    @Req() request: { user: AuthUser },
    @Body() dto: UpsertSubmissionDto,
  ) {
    return this.submissionsService.upsertMySubmission(
      roundId,
      request.user.userId,
      dto,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TEAM')
  getMySubmission(
    @Param('roundId') roundId: string,
    @Req() request: { user: AuthUser },
  ) {
    return this.submissionsService.getMySubmission(roundId, request.user.userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ORGANIZER', 'JURY')
  listByRound(@Param('roundId') roundId: string) {
    return this.submissionsService.listByRound(roundId);
  }
}
