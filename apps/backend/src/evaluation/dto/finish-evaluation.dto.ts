import { IsBoolean, IsOptional } from 'class-validator';

export class FinishEvaluationDto {
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
