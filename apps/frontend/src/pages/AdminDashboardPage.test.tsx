import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { apiRequest } from '../lib/api';
import AdminDashboardPage from './AdminDashboardPage';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

const mockedApiRequest = vi.mocked(apiRequest);

const platformDefaults = {
  minTeamMembers: 2,
  maxTeamMembers: 8,
  defaultMinReviewersPerSubmission: 2,
  defaultProjectTimeZone: 'Europe/Kyiv',
  hideTeamsUntilRegistrationClose: true,
  defaultTournamentMaxTeams: null,
  defaultRegistrationWindowHours: 24,
  defaultRoundDurationHours: 24,
  defaultTournamentDescription: '',
  defaultRoundDescription: '',
};

const emptyMetrics = {
  summary: {
    runningTournaments: 0,
    registrationTournaments: 0,
    tournamentsTotal: 1,
    roundsTotal: 0,
    activeRounds: 0,
    closedRounds: 0,
    evaluatedRounds: 0,
  },
  weekly: {
    labels: [],
    reviewed: [],
    submissions: [],
  },
  pie: {
    active: 0,
    closed: 0,
    evaluated: 0,
    total: 0,
  },
  activeEntities: [],
  activity: [],
};

const tournament = {
  id: 't-1',
  title: 'Falcon Cup',
  description: null,
  status: 'FINISHED',
  startsAt: null,
  registrationOpenAt: '2026-03-10T10:00:00.000Z',
  registrationCloseAt: '2026-03-20T14:00:00.000Z',
  maxTeams: null,
};

const tournamentJury = {
  tournamentId: 't-1',
  tournamentTitle: 'Falcon Cup',
  assigned: [],
  candidates: [],
};

const evaluatedRound = {
  id: 'round-1',
  sequence: 1,
  title: 'Final review',
  description: 'Final evaluation',
  status: 'EVALUATED',
  mustHave: [],
  technologyRequirements: [],
  additionalMaterials: [],
  startsAt: '2026-03-21T10:00:00.000Z',
  deadlineAt: '2026-03-22T10:00:00.000Z',
};

function renderAdminPage() {
  return render(
    <MemoryRouter initialEntries={['/app/admin']}>
      <I18nProvider>
        <AdminDashboardPage />
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('AdminDashboardPage user creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('falconarena_language', 'en');
  });

  it('creates a jury user from the admin panel', async () => {
    mockedApiRequest.mockImplementation(async (path: string, options?: { method?: string; body?: unknown }) => {
      if (path === '/platform/defaults') {
        return {
          minTeamMembers: 2,
          maxTeamMembers: 8,
          defaultMinReviewersPerSubmission: 2,
          defaultProjectTimeZone: 'Europe/Kyiv',
          hideTeamsUntilRegistrationClose: true,
          defaultTournamentMaxTeams: null,
          defaultRegistrationWindowHours: 24,
          defaultRoundDurationHours: 24,
          defaultTournamentDescription: '',
          defaultRoundDescription: '',
        };
      }

      if (path === '/auth/me') {
        return {
          id: 'admin-1',
          email: 'admin@example.com',
          role: 'ADMIN',
        };
      }

      if (path === '/tournaments') {
        return [];
      }

      if (path === '/auth/admin/users' && options?.method === 'POST') {
        return {
          id: 'jury-1',
          email: 'jury@example.com',
          fullName: 'Jury User',
          role: 'JURY',
          createdAt: '2026-03-16T10:00:00.000Z',
        };
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    renderAdminPage();

    const openCreateUserButton = await screen.findByRole('button', { name: 'Create user' });
    fireEvent.click(openCreateUserButton);
    const dialog = await screen.findByRole('dialog', { name: 'Create user' });
    const dialogView = within(dialog);

    fireEvent.change(dialogView.getByLabelText('Full name'), { target: { value: 'Jury User' } });
    fireEvent.change(dialogView.getByLabelText('Email'), { target: { value: 'jury@example.com' } });
    fireEvent.change(dialogView.getByLabelText('Password'), { target: { value: 'strongpass123' } });
    fireEvent.change(dialogView.getByLabelText('Role'), { target: { value: 'JURY' } });

    fireEvent.click(dialogView.getByRole('button', { name: 'Create user' }));

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith('/auth/admin/users', {
        method: 'POST',
        body: {
          fullName: 'Jury User',
          email: 'jury@example.com',
          password: 'strongpass123',
          role: 'JURY',
        },
      });
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Create user' })).not.toBeInTheDocument();
    });
  });

  it('hides ADMIN role option for organizer', async () => {
    mockedApiRequest.mockImplementation(async (path: string) => {
      if (path === '/platform/defaults') {
        return {
          minTeamMembers: 2,
          maxTeamMembers: 8,
          defaultMinReviewersPerSubmission: 2,
          defaultProjectTimeZone: 'Europe/Kyiv',
          hideTeamsUntilRegistrationClose: true,
          defaultTournamentMaxTeams: null,
          defaultRegistrationWindowHours: 24,
          defaultRoundDurationHours: 24,
          defaultTournamentDescription: '',
          defaultRoundDescription: '',
        };
      }

      if (path === '/auth/me') {
        return {
          id: 'organizer-1',
          email: 'organizer@example.com',
          role: 'ORGANIZER',
        };
      }

      if (path === '/tournaments') {
        return [];
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    renderAdminPage();

    const openCreateUserButton = await screen.findByRole('button', { name: 'Create user' });
    fireEvent.click(openCreateUserButton);
    const dialog = await screen.findByRole('dialog', { name: 'Create user' });
    const dialogView = within(dialog);

    const roleSelect = dialogView.getByLabelText('Role') as HTMLSelectElement;
    const options = Array.from(roleSelect.options).map((option) => option.value);

    expect(options).toEqual(['JURY', 'ORGANIZER', 'TEAM']);
  });
});

describe('AdminDashboardPage status recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('falconarena_language', 'en');
  });

  function mockStatusRecoveryRequests(role: 'ADMIN' | 'ORGANIZER', includeEvaluatedRound = false) {
    let recovered = false;
    let roundRecovered = false;

    mockedApiRequest.mockImplementation(
      async (path: string, options?: { method?: string; body?: unknown }) => {
        if (path === '/platform/defaults') {
          return platformDefaults;
        }

        if (path === '/auth/me') {
          return {
            id: role === 'ADMIN' ? 'admin-1' : 'organizer-1',
            email: role === 'ADMIN' ? 'admin@example.com' : 'organizer@example.com',
            role,
          };
        }

        if (path === '/tournaments' && !options?.method) {
          return [{ ...tournament, status: recovered ? 'RUNNING' : 'FINISHED' }];
        }

        if (path === '/dashboard/admin/metrics?tournamentId=t-1') {
          return emptyMetrics;
        }

        if (path === '/activity/admin?tournamentId=t-1') {
          return [];
        }

        if (path === '/tournaments/t-1/rounds') {
          return includeEvaluatedRound
            ? [
                {
                  ...evaluatedRound,
                  status: roundRecovered ? 'SUBMISSION_CLOSED' : 'EVALUATED',
                },
              ]
            : [];
        }

        if (path === '/tournaments/t-1/schedule') {
          return [];
        }

        if (path === '/tournaments/t-1/jury') {
          return tournamentJury;
        }

        if (path === '/tournaments/t-1/status/override' && options?.method === 'PATCH') {
          recovered = true;
          return { ...tournament, status: 'RUNNING' };
        }

        if (
          path === '/tournaments/t-1/rounds/round-1/status/override' &&
          options?.method === 'PATCH'
        ) {
          roundRecovered = true;
          return { ...evaluatedRound, status: 'SUBMISSION_CLOSED' };
        }

        throw new Error(`Unexpected request: ${path}`);
      },
    );
  }

  it('lets admin recover tournament status with a reason', async () => {
    mockStatusRecoveryRequests('ADMIN');
    renderAdminPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Recover status' }));
    const dialog = await screen.findByRole('dialog', { name: 'Recover tournament status' });
    const dialogView = within(dialog);

    fireEvent.change(dialogView.getByLabelText('Recover to status'), {
      target: { value: 'RUNNING' },
    });
    fireEvent.change(dialogView.getByLabelText('Recovery reason'), {
      target: { value: 'Tournament was extended' },
    });
    fireEvent.click(dialogView.getByRole('button', { name: 'Recover status' }));

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith('/tournaments/t-1/status/override', {
        method: 'PATCH',
        body: {
          status: 'RUNNING',
          reason: 'Tournament was extended',
        },
      });
    });
  });

  it('hides tournament status recovery for organizer', async () => {
    mockStatusRecoveryRequests('ORGANIZER');
    renderAdminPage();

    await screen.findByRole('combobox', { name: 'Select tournament' });

    expect(screen.queryByRole('button', { name: 'Recover status' })).not.toBeInTheDocument();
  });

  it('lets admin recover evaluated round with a reason', async () => {
    mockStatusRecoveryRequests('ADMIN', true);
    renderAdminPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Recover evaluation' }));
    const dialog = await screen.findByRole('dialog', { name: 'Recover round evaluation' });
    const dialogView = within(dialog);

    fireEvent.change(dialogView.getByLabelText('Recovery reason'), {
      target: { value: 'Evaluation was finished by mistake' },
    });
    fireEvent.click(dialogView.getByRole('button', { name: 'Recover evaluation' }));

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith(
        '/tournaments/t-1/rounds/round-1/status/override',
        {
          method: 'PATCH',
          body: {
            status: 'SUBMISSION_CLOSED',
            reason: 'Evaluation was finished by mistake',
          },
        },
      );
    });
  });
});
