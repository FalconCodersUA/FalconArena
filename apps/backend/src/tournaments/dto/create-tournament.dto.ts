import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTournamentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date;

  @Type(() => Date)
  @IsDate()
  registrationOpenAt!: Date;

  @Type(() => Date)
  @IsDate()
  registrationCloseAt!: Date;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxTeams?: number;
}
