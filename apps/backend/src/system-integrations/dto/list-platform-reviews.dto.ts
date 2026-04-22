import { PlatformReviewStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListPlatformReviewsDto {
  @IsOptional()
  @IsEnum(PlatformReviewStatus)
  status?: PlatformReviewStatus;
}
