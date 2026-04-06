import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { ROLES, Role } from '../../common/constants/roles';

export const MANAGED_USER_STATUS_FILTERS = ['ALL', 'ACTIVE', 'BLOCKED'] as const;

export type ManagedUserStatusFilter = (typeof MANAGED_USER_STATUS_FILTERS)[number];

const MANAGED_USER_ROLE_FILTERS = ['ALL', ...ROLES] as const;

export class ListManagedUsersDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @IsOptional()
  @IsIn(MANAGED_USER_ROLE_FILTERS)
  role?: 'ALL' | Role;

  @IsOptional()
  @IsIn(MANAGED_USER_STATUS_FILTERS)
  status?: ManagedUserStatusFilter;
}
