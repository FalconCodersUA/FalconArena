import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ROLES } from '../../common/constants/roles';

export class UpdateManagedUserDto {
  @IsOptional()
  @IsIn(ROLES)
  role?: (typeof ROLES)[number];

  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;
}
