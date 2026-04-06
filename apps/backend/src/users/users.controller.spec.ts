import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { UsersController } from './users.controller';

describe('UsersController permissions', () => {
  it('requires ADMIN role on the controller level', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, UsersController);
    expect(roles).toEqual(['ADMIN']);
  });
});
