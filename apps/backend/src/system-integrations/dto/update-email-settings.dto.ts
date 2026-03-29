import { IsBoolean, IsIn, IsOptional, IsString, IsEmail, MaxLength } from 'class-validator';

export class UpdateEmailSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['console', 'resend'])
  provider?: 'console' | 'resend';

  @IsOptional()
  @IsString()
  @IsEmail()
  @MaxLength(255)
  from?: string;

  @IsOptional()
  @IsString()
  @IsEmail()
  @MaxLength(255)
  replyTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  resendApiKey?: string;
}
