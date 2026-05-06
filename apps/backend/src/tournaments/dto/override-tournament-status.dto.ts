import { Transform } from 'class-transformer';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { TournamentStatus } from '@prisma/client';

export class OverrideTournamentStatusDto {
  @IsEnum(TournamentStatus)
  status!: TournamentStatus;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
