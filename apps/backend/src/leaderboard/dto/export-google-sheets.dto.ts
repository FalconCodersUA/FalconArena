import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ExportGoogleSheetsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sheetName?: string;
}
