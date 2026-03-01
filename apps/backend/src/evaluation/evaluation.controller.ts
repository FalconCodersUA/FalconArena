import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { DistributeAssignmentsDto } from './dto/distribute-assignments.dto';
import { SubmitEvaluationDto } from './dto/submit-evaluation.dto';
import { EvaluationService } from './evaluation.service';

@Controller('rounds/:roundId/assignments')
export class EvaluationController {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Post('distribute')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ORGANIZER')
  distribute(
    @Param('roundId') roundId: string,
    @Body() dto: DistributeAssignmentsDto,
  ) {
    return this.evaluationService.distributeAssignments(roundId, dto);
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('JURY')
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
