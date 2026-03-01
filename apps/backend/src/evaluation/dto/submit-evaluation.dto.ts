import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class EvaluationScoresDto {
  @IsInt()
  @Min(0)
  @Max(100)
  technicalBackend!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  technicalDatabase!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  technicalFrontend!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  mustHave!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  stability!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  usability!: number;
}

export class SubmitEvaluationDto {
  @ValidateNested()
  @Type(() => EvaluationScoresDto)
  scores!: EvaluationScoresDto;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
