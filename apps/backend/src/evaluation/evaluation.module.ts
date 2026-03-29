import { Module } from '@nestjs/common';
import { SystemIntegrationsModule } from '../system-integrations/system-integrations.module';
import { EvaluationController } from './evaluation.controller';
import { RoundEvaluationController } from './round-evaluation.controller';
import { EvaluationService } from './evaluation.service';

@Module({
  imports: [SystemIntegrationsModule],
  controllers: [EvaluationController, RoundEvaluationController],
  providers: [EvaluationService],
  exports: [EvaluationService],
})
export class EvaluationModule {}
