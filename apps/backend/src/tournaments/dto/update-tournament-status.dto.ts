import { TournamentStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateTournamentStatusDto {
  @IsEnum(TournamentStatus)
  status!: TournamentStatus;
}
