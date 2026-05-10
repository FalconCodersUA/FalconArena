import { describe, expect, it, vi } from 'vitest';
import { TeamsController, TeamsDirectoryController } from './teams.controller';

describe('TeamsController', () => {
  it('routes the all-tournaments alias to the visible teams directory', () => {
    const teamsService = {
      listAllVisible: vi.fn().mockReturnValue([{ id: 'team-1' }]),
      listByTournament: vi.fn(),
    };
    const controller = new TeamsController(teamsService as never);

    expect(controller.list('all')).toEqual([{ id: 'team-1' }]);
    expect(teamsService.listAllVisible).toHaveBeenCalledTimes(1);
    expect(teamsService.listByTournament).not.toHaveBeenCalled();
  });

  it('keeps tournament scoped team lists unchanged', () => {
    const teamsService = {
      listAllVisible: vi.fn(),
      listByTournament: vi.fn().mockReturnValue([{ id: 'team-2' }]),
    };
    const controller = new TeamsController(teamsService as never);

    expect(controller.list('tournament-1')).toEqual([{ id: 'team-2' }]);
    expect(teamsService.listByTournament).toHaveBeenCalledWith('tournament-1');
    expect(teamsService.listAllVisible).not.toHaveBeenCalled();
  });
});

describe('TeamsDirectoryController', () => {
  it('keeps the direct teams directory endpoint available', () => {
    const teamsService = {
      listAllVisible: vi.fn().mockReturnValue([{ id: 'team-1' }]),
    };
    const controller = new TeamsDirectoryController(teamsService as never);

    expect(controller.listAllVisible()).toEqual([{ id: 'team-1' }]);
    expect(teamsService.listAllVisible).toHaveBeenCalledTimes(1);
  });
});
