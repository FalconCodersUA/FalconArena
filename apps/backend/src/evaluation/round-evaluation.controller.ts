import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
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
  ) {
    return this.evaluationService.finishRoundEvaluation(roundId, dto);
  }
}
