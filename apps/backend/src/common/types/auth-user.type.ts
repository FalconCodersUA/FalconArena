import { Role } from '../constants/roles';

export type AuthUser = {
  userId: string;
  email: string;
  role: Role;
};
