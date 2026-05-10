import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { apiRequest } from '../lib/api';
import JuryDashboardPage from './JuryDashboardPage';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

const mockedApiRequest = vi.mocked(apiRequest);

const emptyMetrics = {
  summary: {
    total: 1,
    pending: 1,
    evaluated: 0,
    currentScore: 0,
  },
  weekly: {
    labels: [],
    reviewed: [],
    assigned: [],
  },
  pie: {
    pending: 1,
    evaluated: 0,
    total: 1,
  },
  activeEntities: [],
  activity: [],
};

function renderJuryDashboardPage() {
  return render(
    <MemoryRouter initialEntries={['/app/jury']}>
      <I18nProvider>
        <JuryDashboardPage />
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('JuryDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('falconarena_language', 'en');
  });

  it('warns but still shows the save action when evaluating an active round', async () => {
    mockedApiRequest.mockImplementation(async (path: string) => {
      if (path === '/auth/me') {
        return {
          id: 'jury-1',
          fullName: 'Jury User',
          email: 'jury@example.com',
          role: 'JURY',
        };
      }

      if (path === '/tournaments') {
        return [
          {
            id: 'tournament-1',
            title: 'Falcon Cup',
            status: 'RUNNING',
          },
        ];
      }

      if (path === '/tournaments/tournament-1/rounds') {
        return [
          {
            id: 'round-1',
            title: 'Round 1',
            status: 'ACTIVE',
            deadlineAt: '2026-06-01T10:00:00.000Z',
          },
        ];
      }

      if (path === '/tournaments/tournament-1/schedule') {
        return [];
      }

      if (path === '/rounds/round-1/assignments/me') {
        return [
          {
            id: 'assignment-1',
            assignedAt: '2026-05-10T10:00:00.000Z',
            submission: {
              id: 'submission-1',
              repoUrl: 'https://github.com/example/repo',
              demoUrl: 'https://youtu.be/demo',
              liveDemoUrl: null,
              shortSummary: 'Submission summary',
              team: {
                id: 'team-1',
                name: 'Team One',
              },
            },
            evaluation: null,
          },
        ];
      }

      if (path.startsWith('/dashboard/jury/metrics')) {
        return emptyMetrics;
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    renderJuryDashboardPage();

    expect(await screen.findByText('Round is still active')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Submissions may still change until submission intake is closed. You can save an evaluation now, but it should be reviewed again before final completion.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save evaluation' })).toBeEnabled();
  });
});
