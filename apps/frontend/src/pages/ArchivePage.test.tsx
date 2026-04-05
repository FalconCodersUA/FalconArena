import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { apiRequest } from '../lib/api';
import ArchivePage from './ArchivePage';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

const mockedApiRequest = vi.mocked(apiRequest);

function renderArchivePage() {
  return render(
    <MemoryRouter initialEntries={['/app/archive?tournamentId=t-finished']}>
      <I18nProvider>
        <ArchivePage />
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('ArchivePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('falconarena_language', 'en');
  });

  it('renders finished tournament archive with leaderboard and submissions', async () => {
    mockedApiRequest.mockImplementation(async (path: string) => {
      if (path === '/tournaments?status=FINISHED') {
        return [
          {
            id: 't-finished',
            title: 'Falcon Final 2026',
            status: 'FINISHED',
            startsAt: '2026-03-10T10:00:00.000Z',
            registrationOpenAt: '2026-03-01T10:00:00.000Z',
            registrationCloseAt: '2026-03-05T10:00:00.000Z',
            canTeamRegister: false,
          },
        ];
      }

      if (path === '/tournaments/t-finished/archive') {
        return {
          tournament: {
            id: 't-finished',
            title: 'Falcon Final 2026',
            description: 'Final event archive.',
            status: 'FINISHED',
            startsAt: '2026-03-10T10:00:00.000Z',
            registrationOpenAt: '2026-03-01T10:00:00.000Z',
            registrationCloseAt: '2026-03-05T10:00:00.000Z',
            canTeamRegister: false,
          },
          summary: {
            teamsCount: 1,
            roundsCount: 1,
            submissionsCount: 1,
          },
          leaderboard: {
            tournament: {
              id: 't-finished',
              title: 'Falcon Final 2026',
              status: 'FINISHED',
            },
            scoring: {
              scale: '0-100',
              totalFormula: 'sum(roundAverageScore)',
              roundFormula: 'average(juryEvaluationTotals)',
              evaluationFormula: 'average(6 category scores)',
            },
            rows: [
              {
                rank: 1,
                teamId: 'team-1',
                teamName: 'Falcons',
                organization: 'Kyiv',
                totalScore: 91,
                averageScore: 91,
                evaluationsCount: 2,
                categoryAverages: {
                  technicalBackend: 92,
                  technicalDatabase: 85,
                  technicalFrontend: 88,
                  mustHave: 93,
                  stability: 90,
                  usability: 94,
                },
                rounds: [],
              },
            ],
          },
          teams: [
            {
              id: 'team-1',
              name: 'Falcons',
              organization: 'Kyiv',
              membersCount: 3,
              submissionsCount: 1,
              rank: 1,
              totalScore: 91,
              averageScore: 91,
              evaluationsCount: 2,
            },
          ],
          rounds: [
            {
              id: 'round-1',
              sequence: 1,
              title: 'Round 1',
              description: 'Build the first release.',
              status: 'EVALUATED',
              startsAt: '2026-03-11T10:00:00.000Z',
              deadlineAt: '2026-03-12T10:00:00.000Z',
              submissionsCount: 1,
              evaluatedSubmissionsCount: 1,
              averageScore: 91,
              submissions: [
                {
                  id: 'submission-1',
                  teamId: 'team-1',
                  teamName: 'Falcons',
                  organization: 'Kyiv',
                  repoUrl: 'https://github.com/example/falcons',
                  demoUrl: 'https://youtu.be/demo',
                  liveDemoUrl: 'https://demo.example.com',
                  shortSummary: 'Submitted final version.',
                  status: 'LOCKED',
                  submittedAt: '2026-03-12T09:00:00.000Z',
                  evaluationsCount: 2,
                  averageScore: 91,
                  categoryAverages: {
                    technicalBackend: 92,
                    technicalDatabase: 85,
                    technicalFrontend: 88,
                    mustHave: 93,
                    stability: 90,
                    usability: 94,
                  },
                },
              ],
            },
          ],
        };
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    renderArchivePage();

    await screen.findByRole('heading', { name: 'Final results', level: 2 });

    expect(screen.getAllByText('Falcon Final 2026').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Falcons/).length).toBeGreaterThan(0);
    expect(screen.getByText('Round 1')).toBeInTheDocument();
    expect(screen.getByText('Submitted final version.')).toBeInTheDocument();
  });
});
