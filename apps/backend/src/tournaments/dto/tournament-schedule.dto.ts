import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const TOURNAMENT_SCHEDULE_EVENT_TYPES = [
  'ROUND',
  'CONSULTATION',
  'DEADLINE',
  'ANNOUNCEMENT',
  'OTHER',
] as const;

type TournamentScheduleEventTypeValue =
  (typeof TOURNAMENT_SCHEDULE_EVENT_TYPES)[number];

export class CreateTournamentScheduleEventDto {
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsIn(TOURNAMENT_SCHEDULE_EVENT_TYPES)
  type?: TournamentScheduleEventTypeValue;

  @Type(() => Date)
  @IsDate()
  startsAt!: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  location?: string;
}

export class UpdateTournamentScheduleEventDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsIn(TOURNAMENT_SCHEDULE_EVENT_TYPES)
  type?: TournamentScheduleEventTypeValue;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  location?: string;
}
