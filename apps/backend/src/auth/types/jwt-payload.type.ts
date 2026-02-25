import { Role } from '../../common/constants/roles';

export type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
};
