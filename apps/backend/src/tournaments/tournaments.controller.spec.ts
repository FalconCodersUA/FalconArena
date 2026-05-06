import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { TournamentsController } from './tournaments.controller';

describe('TournamentsController permissions', () => {
  it('allows only admin and organizer to create tournaments', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, TournamentsController.prototype.create);
    expect(roles).toEqual(['ADMIN', 'ORGANIZER']);
  });

  it('allows only admin and organizer to update tournament status', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, TournamentsController.prototype.updateStatus);
    expect(roles).toEqual(['ADMIN', 'ORGANIZER']);
  });

  it('allows only admin to override tournament status', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, TournamentsController.prototype.overrideStatus);
    expect(roles).toEqual(['ADMIN']);
  });
});
