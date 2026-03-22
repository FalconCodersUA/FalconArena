import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class EditProfileSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000000)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  fullName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  userName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(10, 10)
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  presentAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  permanentAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  country?: string;
}

export class PreferencesProfileSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  interfaceLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  timeZone?: string;

  @IsOptional()
  @IsBoolean()
  notifyAnnouncements?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyReviews?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyMessages?: boolean;
}

export class SecurityProfileSettingsDto {
  @IsOptional()
  @IsString()
  @Length(8, 128)
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @Length(8, 128)
  newPassword?: string;
}

export class UpdateProfileSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => EditProfileSettingsDto)
  edit?: EditProfileSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PreferencesProfileSettingsDto)
  preferences?: PreferencesProfileSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SecurityProfileSettingsDto)
  security?: SecurityProfileSettingsDto;
}
