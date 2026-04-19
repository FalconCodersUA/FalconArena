import { Transform } from 'class-transformer';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

function toOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export class UpdatePlatformContentDto {
  @IsOptional()
  @IsObject()
  hero?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  product?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  roles?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  cta?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  contacts?: Record<string, unknown>;

  @IsOptional()
  @Transform(({ value }) => toOptionalString(value))
  @IsString()
  @MaxLength(160)
  aboutPageTitle?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalString(value))
  @IsString()
  @MaxLength(5000)
  aboutPageDescription?: string;
}
