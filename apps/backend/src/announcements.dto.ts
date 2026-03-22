import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';

export const ANNOUNCEMENT_AUDIENCES = [
  'ALL',
  'TEAM',
  'JURY',
  'ADMIN',
  'ORGANIZER',
] as const;

type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

function transformBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0') {
      return false;
    }
  }

  return value;
}

export class ListAnnouncementsDto {
  @IsOptional()
  @Transform(({ value }) => transformBoolean(value))
  @IsBoolean()
  includeInactive?: boolean;
}

export class CreateAnnouncementDto {
  @IsString()
  @Length(3, 140)
  title!: string;

  @IsString()
  @Length(10, 5000)
  body!: string;

  @IsOptional()
  @IsIn(ANNOUNCEMENT_AUDIENCES)
  audience?: AnnouncementAudience;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  linkUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAnnouncementDto {
  @IsOptional()
  @IsString()
  @Length(3, 140)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(10, 5000)
  body?: string;

  @IsOptional()
  @IsIn(ANNOUNCEMENT_AUDIENCES)
  audience?: AnnouncementAudience;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  linkUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

