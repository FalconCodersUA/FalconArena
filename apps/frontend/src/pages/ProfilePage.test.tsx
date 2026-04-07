import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { ApiError, apiRequest } from '../lib/api';
import ProfilePage from './ProfilePage';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

const mockedApiRequest = vi.mocked(apiRequest);

function renderProfilePage() {
  return render(
    <I18nProvider>
      <ProfilePage />
    </I18nProvider>,
  );
}

function setEnglish() {
  localStorage.setItem('falconarena_language', 'en');
}

function unexpectedRequest(path: string): never {
  throw new Error(`Unexpected request: ${path}`);
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setEnglish();
  });

  it('shows loading state while profile data is pending', () => {
    mockedApiRequest.mockImplementation(() => new Promise(() => undefined));

    renderProfilePage();

    expect(screen.getByLabelText('Loading profile...')).toBeInTheDocument();
  });

  it('renders TEAM summary with members and submissions counts', async () => {
    mockedApiRequest.mockImplementation(async (path: string) => {
      if (path === '/auth/me') {
        return {
          id: 'user-team-1',
          fullName: 'Team Captain',
          email: 'team@example.com',
          role: 'TEAM',
          createdAt: '2026-03-01T10:00:00.000Z',
        };
      }

      if (path === '/tournaments') {
        return [
          {
            id: 'tour-1',
            title: 'Spring Arena',
            status: 'RUNNING',
            createdById: 'admin-1',
          },
          {
            id: 'tour-2',
            title: 'Autumn Arena',
            status: 'REGISTRATION',
            createdById: 'admin-2',
          },
        ];
      }

      if (path === '/tournaments/tour-1/teams/me') {
        return {
          id: 'team-1',
          name: 'Alpha Team',
          captain: { id: 'user-team-1' },
          members: [{ id: 'm-1' }, { id: 'm-2' }],
        };
      }

      if (path === '/tournaments/tour-2/teams/me') {
        throw new ApiError('Team not found', 404);
      }

      if (path === '/tournaments/tour-1/rounds') {
        return [
          { id: 'round-1', title: 'Round 1', status: 'ACTIVE' },
          { id: 'round-2', title: 'Round 2', status: 'DRAFT' },
        ];
      }

      if (path === '/rounds/round-1/submissions/me') {
        return {
          id: 'submission-1',
          repoUrl: 'https://github.com/example/team',
          demoUrl: 'https://youtu.be/example',
          liveDemoUrl: null,
          submittedAt: '2026-03-03T10:00:00.000Z',
          status: 'SUBMITTED',
        };
      }

      if (path === '/rounds/round-2/submissions/me') {
        throw new ApiError('Submission not found', 404);
      }

      return unexpectedRequest(path);
    });

    renderProfilePage();

    await screen.findByText('User profile');

    expect(screen.getByRole('heading', { name: 'Team participation' })).toBeInTheDocument();
    expect(screen.getByText('Alpha Team')).toBeInTheDocument();
    expect(screen.getByText(/Members:\s*3/)).toBeInTheDocument();
    expect(screen.getByText(/Submissions:\s*1/)).toBeInTheDocument();
  });

  it('renders JURY totals and pending assignments', async () => {
    mockedApiRequest.mockImplementation(async (path: string) => {
      if (path === '/auth/me') {
        return {
          id: 'jury-1',
          fullName: 'Jury User',
          email: 'jury@example.com',
          role: 'JURY',
          createdAt: '2026-03-01T10:00:00.000Z',
        };
      }

      if (path === '/tournaments') {
        return [
          {
            id: 'tour-a',
            title: 'Tournament A',
            status: 'RUNNING',
            createdById: 'admin-1',
          },
          {
            id: 'tour-b',
            title: 'Tournament B',
            status: 'RUNNING',
            createdById: 'admin-2',
          },
        ];
      }

      if (path === '/tournaments/tour-a/rounds') {
        return [{ id: 'round-a-1', title: 'Round A1', status: 'ACTIVE' }];
      }

      if (path === '/tournaments/tour-b/rounds') {
        return [{ id: 'round-b-1', title: 'Round B1', status: 'ACTIVE' }];
      }

      if (path === '/rounds/round-a-1/assignments/me') {
        return [
          {
            id: 'assignment-1',
            assignedAt: '2026-03-04T10:00:00.000Z',
            submission: {
              id: 'submission-1',
              repoUrl: 'https://github.com/example/a1',
              demoUrl: 'https://youtu.be/a1',
              liveDemoUrl: null,
              team: {
                id: 'team-1',
                name: 'Team Alpha',
              },
            },
            evaluation: { id: 'eval-1', totalScore: 89 },
          },
          {
            id: 'assignment-2',
            assignedAt: '2026-03-04T11:00:00.000Z',
            submission: {
              id: 'submission-2',
              repoUrl: 'https://github.com/example/a2',
              demoUrl: 'https://youtu.be/a2',
              liveDemoUrl: null,
              team: {
                id: 'team-2',
                name: 'Team Beta',
              },
            },
            evaluation: null,
          },
        ];
      }

      if (path === '/rounds/round-b-1/assignments/me') {
        return [];
      }

      return unexpectedRequest(path);
    });

    renderProfilePage();

    await screen.findByText('User profile');

    expect(screen.getByText('Jury work overview')).toBeInTheDocument();
    expect(screen.getByText(/Total assignments:\s*2/)).toBeInTheDocument();
    expect(screen.getByText(/Evaluated:\s*1/)).toBeInTheDocument();
    expect(screen.getByText(/Pending:\s*1/)).toBeInTheDocument();
    expect(screen.getByText('Tournament A')).toBeInTheDocument();
    expect(screen.queryByText('Tournament B')).not.toBeInTheDocument();
  });

  it('renders ADMIN summary only for tournaments created by current user', async () => {
    mockedApiRequest.mockImplementation(async (path: string) => {
      if (path === '/auth/me') {
        return {
          id: 'organizer-1',
          fullName: 'Organizer',
          email: 'org@example.com',
          role: 'ORGANIZER',
          createdAt: '2026-03-01T10:00:00.000Z',
        };
      }

      if (path === '/tournaments') {
        return [
          {
            id: 'tour-own',
            title: 'Own Tournament',
            status: 'REGISTRATION',
            createdById: 'organizer-1',
          },
          {
            id: 'tour-external',
            title: 'External Tournament',
            status: 'RUNNING',
            createdById: 'another-user',
          },
        ];
      }

      if (path === '/tournaments/tour-own/rounds') {
        return [
          { id: 'r-1', title: 'Round 1', status: 'DRAFT' },
          { id: 'r-2', title: 'Round 2', status: 'ACTIVE' },
        ];
      }

      return unexpectedRequest(path);
    });

    renderProfilePage();

    await screen.findByRole('heading', { name: 'Created tournaments' });

    expect(screen.getByText('Own Tournament')).toBeInTheDocument();
    expect(screen.getByText(/Rounds:\s*2/)).toBeInTheDocument();
    expect(screen.queryByText('External Tournament')).not.toBeInTheDocument();
  });

  it('shows error and reloads profile after retry', async () => {
    let shouldFail = true;

    mockedApiRequest.mockImplementation(async (path: string) => {
      if (path === '/auth/me') {
        if (shouldFail) {
          shouldFail = false;
          throw new Error('Profile request failed');
        }

        return {
          id: 'user-team-2',
          fullName: 'Recovered Team User',
          email: 'team2@example.com',
          role: 'TEAM',
          createdAt: '2026-03-02T10:00:00.000Z',
        };
      }

      if (path === '/tournaments') {
        return [];
      }

      return unexpectedRequest(path);
    });

    renderProfilePage();

    await screen.findByText('Profile request failed');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await screen.findByText('User profile');
    await waitFor(() => {
      const meCalls = mockedApiRequest.mock.calls.filter((call) => call[0] === '/auth/me');
      expect(meCalls.length).toBe(2);
    });
  });
});
