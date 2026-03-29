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
