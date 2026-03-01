import { TournamentStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListTournamentsDto {
  @IsOptional()
  @IsEnum(TournamentStatus)
  status?: TournamentStatus;
}
