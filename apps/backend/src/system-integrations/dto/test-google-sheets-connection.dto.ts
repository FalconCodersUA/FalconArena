import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class TestGoogleSheetsConnectionDto {
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  webhookUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  secret?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  defaultSheetName?: string;
}
