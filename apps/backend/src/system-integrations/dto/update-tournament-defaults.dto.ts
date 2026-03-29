import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

function toOptionalInt(value: unknown) {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function toOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export class UpdateTournamentDefaultsDto {
  @IsOptional()
  @Transform(({ value }) => toOptionalInt(value))
  @IsInt()
  @Min(1)
  @Max(20)
  minTeamMembers?: number;

  @IsOptional()
  @Transform(({ value }) => toOptionalInt(value))
  @IsInt()
  @Min(1)
  @Max(20)
  maxTeamMembers?: number;

  @IsOptional()
  @Transform(({ value }) => toOptionalInt(value))
  @IsInt()
  @Min(1)
  @Max(12)
  defaultMinReviewersPerSubmission?: number;

  @IsOptional()
  @Transform(({ value }) => toOptionalString(value))
  @IsString()
  @MaxLength(120)
  defaultProjectTimeZone?: string;

  @IsOptional()
  @IsBoolean()
  hideTeamsUntilRegistrationClose?: boolean;

  @IsOptional()
  @Transform(({ value }) => toOptionalInt(value))
  @IsInt()
  @Min(1)
  @Max(500)
  defaultTournamentMaxTeams?: number;

  @IsOptional()
  @Transform(({ value }) => toOptionalInt(value))
  @IsInt()
  @Min(1)
  @Max(24 * 30)
  defaultRegistrationWindowHours?: number;

  @IsOptional()
  @Transform(({ value }) => toOptionalInt(value))
  @IsInt()
  @Min(1)
  @Max(24 * 30)
  defaultRoundDurationHours?: number;

  @IsOptional()
  @Transform(({ value }) => toOptionalString(value))
  @IsString()
  @MaxLength(4000)
  defaultTournamentDescription?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalString(value))
  @IsString()
  @MaxLength(5000)
  defaultRoundDescription?: string;
}
