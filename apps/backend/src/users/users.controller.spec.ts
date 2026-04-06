import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { UsersController } from './users.controller';

describe('UsersController permissions', () => {
  it('requires ADMIN role on the controller level', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, UsersController);
    expect(roles).toEqual(['ADMIN']);
  });

  it('exports CSV with attachment headers', async () => {
    const usersService = {
      exportManagedUsersCsv: vi.fn().mockResolvedValue('csv-body'),
      listManagedUsers: vi.fn(),
      updateManagedUser: vi.fn(),
    };
    const controller = new UsersController(usersService as never);
    const response = { setHeader: vi.fn() };

    await expect(
      controller.exportManagedUsersCsv({ role: 'TEAM' }, response),
    ).resolves.toBe('csv-body');

    expect(usersService.exportManagedUsersCsv).toHaveBeenCalledWith({ role: 'TEAM' });
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/csv; charset=utf-8',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="users-export.csv"',
    );
  });
});
