import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { FinishEvaluationDto } from './dto/finish-evaluation.dto';
import { EvaluationService } from './evaluation.service';

@Controller('rounds')
export class RoundEvaluationController {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Post(':roundId/finish-evaluation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ORGANIZER')
  finishRoundEvaluation(
    @Param('roundId') roundId: string,
    @Body() dto: FinishEvaluationDto,
    @Req() request: { user: AuthUser },
  ) {
    return this.evaluationService.finishRoundEvaluation(roundId, dto, request.user);
  }
}
