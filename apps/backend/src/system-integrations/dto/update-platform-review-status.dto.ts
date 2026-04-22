import { PlatformReviewStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

type ModeratedPlatformReviewStatus =
  | (typeof PlatformReviewStatus)['APPROVED']
  | (typeof PlatformReviewStatus)['REJECTED'];

export class UpdatePlatformReviewStatusDto {
  @IsIn([PlatformReviewStatus.APPROVED, PlatformReviewStatus.REJECTED])
  status!: ModeratedPlatformReviewStatus;
}
