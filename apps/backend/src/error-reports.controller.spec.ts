import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ROLES_KEY } from './common/decorators/roles.decorator';
import { ErrorReportsController } from './error-reports.controller';

describe('ErrorReportsController permissions', () => {
  it('allows only admin to list error reports', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ErrorReportsController);
    expect(roles).toEqual(['ADMIN']);
  });
});
