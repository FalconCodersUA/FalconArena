import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { DistributeAssignmentsDto } from './dto/distribute-assignments.dto';
import { SubmitEvaluationDto } from './dto/submit-evaluation.dto';
import { EvaluationService } from './evaluation.service';

@Controller('rounds/:roundId/assignments')
export class EvaluationController {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Post('distribute')
  @UseGuards(JwtAuthGuard, RolesGuard, RateLimitGuard)
  @Roles('ADMIN', 'ORGANIZER')
  @RateLimit({
    bucket: 'evaluation-distribute',
    limit: 5,
    windowSeconds: 60,
    keyStrategy: 'user',
  })
  distribute(
    @Param('roundId') roundId: string,
    @Body() dto: DistributeAssignmentsDto,
    @Req() request: { user: AuthUser },
  ) {
    return this.evaluationService.distributeAssignments(roundId, dto, request.user);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ORGANIZER')
  listByRound(@Param('roundId') roundId: string) {
    return this.evaluationService.listRoundAssignments(roundId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('JURY')
  listMyAssignments(
    @Param('roundId') roundId: string,
    @Req() request: { user: AuthUser },
  ) {
    return this.evaluationService.listMyAssignments(roundId, request.user.userId);
  }

  @Post(':assignmentId/evaluation')
  @UseGuards(JwtAuthGuard, RolesGuard, RateLimitGuard)
  @Roles('JURY')
  @RateLimit({
    bucket: 'jury-submit-evaluation',
    limit: 20,
    windowSeconds: 60,
    keyStrategy: 'user',
  })
  submitEvaluation(
    @Param('roundId') roundId: string,
    @Param('assignmentId') assignmentId: string,
    @Req() request: { user: AuthUser },
    @Body() dto: SubmitEvaluationDto,
  ) {
    return this.evaluationService.submitEvaluation(
      roundId,
      assignmentId,
      request.user.userId,
      dto,
    );
  }
}
