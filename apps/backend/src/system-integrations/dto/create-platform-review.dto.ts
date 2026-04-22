import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreatePlatformReviewDto {
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(10)
  @MaxLength(700)
  text!: string;
}
