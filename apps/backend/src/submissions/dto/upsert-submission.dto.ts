import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class UpsertSubmissionDto {
  @IsUrl({ require_protocol: true })
  repoUrl!: string;

  @IsUrl({ require_protocol: true })
  demoUrl!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  liveDemoUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  shortSummary?: string;
}
