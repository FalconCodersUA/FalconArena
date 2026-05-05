import { IsArray, IsString } from 'class-validator';

export class UpdateTournamentJuryDto {
  @IsArray()
  @IsString({ each: true })
  juryUserIds!: string[];
}
