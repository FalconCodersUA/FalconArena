import { Transform } from 'class-transformer';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { RoundStatus } from '@prisma/client';

export class OverrideRoundStatusDto {
  @IsEnum(RoundStatus)
  status!: RoundStatus;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
