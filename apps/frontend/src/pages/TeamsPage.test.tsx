import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { apiRequest } from '../lib/api';
import TeamsPage from './TeamsPage';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

const mockedApiRequest = vi.mocked(apiRequest);

function renderTeamsPage(initialPath = '/app/teams?tournamentId=all') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <I18nProvider>
        <TeamsPage />
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('TeamsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('falconarena_language', 'en');
  });

  it('loads all visible teams and switches back to a tournament scoped list', async () => {
    mockedApiRequest.mockImplementation(async (path: string) => {
      if (path === '/tournaments') {
        return [
          {
            id: 't-running',
            title: 'Spring Cup',
            status: 'RUNNING',
          },
          {
            id: 't-finished',
            title: 'Final Cup',
            status: 'FINISHED',
          },
        ];
      }

      if (path === '/teams') {
        return [
          {
            id: 'team-1',
            tournamentId: 't-running',
            tournamentTitle: 'Spring Cup',
            tournamentStatus: 'RUNNING',
            name: 'Falcons',
            organization: 'Falcon School',
            createdAt: '2026-04-12T10:00:00.000Z',
            membersCount: 3,
          },
          {
            id: 'team-2',
            tournamentId: 't-finished',
            tournamentTitle: 'Final Cup',
            tournamentStatus: 'FINISHED',
            name: 'Owls',
            organization: null,
            createdAt: '2026-04-13T10:00:00.000Z',
            membersCount: 2,
          },
        ];
      }

      if (path === '/tournaments/t-running/teams') {
        return [
          {
            id: 'team-1',
            name: 'Falcons',
            organization: 'Falcon School',
            createdAt: '2026-04-12T10:00:00.000Z',
            membersCount: 3,
          },
        ];
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    renderTeamsPage();

    await screen.findByText('Falcons');
    expect(screen.getByText('Owls')).toBeInTheDocument();
    expect(screen.getByText(/Tournament:\s+Spring Cup/)).toBeInTheDocument();
    expect(mockedApiRequest).toHaveBeenCalledWith('/teams');

    fireEvent.change(screen.getByLabelText('Select tournament'), {
      target: { value: 't-running' },
    });

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith('/tournaments/t-running/teams');
    });
  });
});
