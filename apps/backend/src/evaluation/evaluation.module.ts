import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs.module';
import { SystemIntegrationsModule } from '../system-integrations/system-integrations.module';
import { EvaluationController } from './evaluation.controller';
import { RoundEvaluationController } from './round-evaluation.controller';
import { EvaluationService } from './evaluation.service';

@Module({
  imports: [AuditLogsModule, SystemIntegrationsModule],
  controllers: [EvaluationController, RoundEvaluationController],
  providers: [EvaluationService],
  exports: [EvaluationService],
})
export class EvaluationModule {}
