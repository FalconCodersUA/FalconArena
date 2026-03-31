import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { SystemIntegrationsController } from './system-integrations.controller';

describe('SystemIntegrationsController permissions', () => {
  it('requires admin role on the controller level', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, SystemIntegrationsController);
    expect(roles).toEqual(['ADMIN']);
  });
});
