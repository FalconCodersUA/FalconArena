import { Module } from '@nestjs/common';
import { EvaluationController } from './evaluation.controller';
import { RoundEvaluationController } from './round-evaluation.controller';
import { EvaluationService } from './evaluation.service';

@Module({
  controllers: [EvaluationController, RoundEvaluationController],
  providers: [EvaluationService],
  exports: [EvaluationService],
})
export class EvaluationModule {}
