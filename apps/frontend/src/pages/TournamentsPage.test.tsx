import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { apiRequest } from '../lib/api';
import TournamentsPage from './TournamentsPage';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

const mockedApiRequest = vi.mocked(apiRequest);

function renderTournamentsPage() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <TournamentsPage />
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('TournamentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('falconarena_language', 'en');
  });

  it('filters tournaments by visible status instead of registration availability', async () => {
    mockedApiRequest.mockImplementation(async (path: string) => {
      if (path === '/tournaments') {
        return [
          {
            id: 't-registration-open',
            title: 'Open Registration Cup',
            status: 'REGISTRATION',
            startsAt: '2026-05-20T10:00:00.000Z',
            registrationOpenAt: '2026-05-01T10:00:00.000Z',
            registrationCloseAt: '2026-05-18T10:00:00.000Z',
            canTeamRegister: true,
          },
          {
            id: 't-registration-closed',
            title: 'Closed Registration Cup',
            status: 'REGISTRATION',
            startsAt: '2026-05-22T10:00:00.000Z',
            registrationOpenAt: '2026-04-01T10:00:00.000Z',
            registrationCloseAt: '2026-04-18T10:00:00.000Z',
            canTeamRegister: false,
          },
          {
            id: 't-running',
            title: 'Running Cup',
            status: 'RUNNING',
            startsAt: '2026-05-10T10:00:00.000Z',
            registrationOpenAt: '2026-04-01T10:00:00.000Z',
            registrationCloseAt: '2026-04-18T10:00:00.000Z',
            canTeamRegister: false,
          },
          {
            id: 't-draft',
            title: 'Draft Cup',
            status: 'DRAFT',
            startsAt: null,
            registrationOpenAt: '2026-06-01T10:00:00.000Z',
            registrationCloseAt: '2026-06-18T10:00:00.000Z',
            canTeamRegister: false,
          },
          {
            id: 't-finished',
            title: 'Finished Cup',
            status: 'FINISHED',
            startsAt: '2026-03-01T10:00:00.000Z',
            registrationOpenAt: '2026-02-01T10:00:00.000Z',
            registrationCloseAt: '2026-02-18T10:00:00.000Z',
            canTeamRegister: false,
          },
        ];
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    renderTournamentsPage();

    await screen.findByText('Open Registration Cup');
    expect(screen.getByText('Closed Registration Cup')).toBeInTheDocument();
    expect(screen.getByText('Running Cup')).toBeInTheDocument();
    expect(screen.queryByText('Finished Cup')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Registration' }));

    expect(screen.getByText('Open Registration Cup')).toBeInTheDocument();
    expect(screen.getByText('Closed Registration Cup')).toBeInTheDocument();
    expect(screen.queryByText('Running Cup')).not.toBeInTheDocument();
    expect(screen.queryByText('Draft Cup')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Running' }));

    expect(screen.getByText('Running Cup')).toBeInTheDocument();
    expect(screen.queryByText('Open Registration Cup')).not.toBeInTheDocument();
    expect(screen.queryByText('Closed Registration Cup')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Finished' }));

    await waitFor(() => {
      expect(screen.getByText('Finished Cup')).toBeInTheDocument();
    });
    expect(screen.queryByText('Running Cup')).not.toBeInTheDocument();
  });
});
