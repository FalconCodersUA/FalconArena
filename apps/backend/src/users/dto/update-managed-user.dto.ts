import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ROLES } from '../../common/constants/roles';

export class UpdateManagedUserDto {
  @IsOptional()
  @IsIn(ROLES)
  role?: (typeof ROLES)[number];

  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  blockedReason?: string;
}
