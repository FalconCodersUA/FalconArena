import { RoundStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateRoundStatusDto {
  @IsEnum(RoundStatus)
  status!: RoundStatus;
}
