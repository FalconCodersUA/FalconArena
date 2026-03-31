import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { AuthController } from './auth.controller';

describe('AuthController permissions', () => {
  it('protects admin user creation for admin and organizer roles', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AuthController.prototype.createUserByAdmin);
    expect(roles).toEqual(['ADMIN', 'ORGANIZER']);
  });

  it('protects admin ping for admin and organizer roles', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AuthController.prototype.adminPing);
    expect(roles).toEqual(['ADMIN', 'ORGANIZER']);
  });
});
