import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../i18n/I18nProvider';
import { apiRequest } from '../lib/api';
import AdminUsersPage from './AdminUsersPage';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

const mockedApiRequest = vi.mocked(apiRequest);

const MANAGED_USERS = [
  {
    id: 'user-1',
    email: 'admin@example.com',
    fullName: 'Admin User',
    role: 'ADMIN',
    isBlocked: false,
    createdAt: '2026-04-07T08:00:00.000Z',
    updatedAt: '2026-04-07T08:00:00.000Z',
  },
  {
    id: 'user-2',
    email: 'jury@example.com',
    fullName: 'Jury User',
    role: 'JURY',
    isBlocked: false,
    createdAt: '2026-04-07T09:00:00.000Z',
    updatedAt: '2026-04-07T09:00:00.000Z',
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <AdminUsersPage />
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('AdminUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('falconarena_language', 'en');
    localStorage.setItem(
      'falconarena_auth_user',
      JSON.stringify({
        id: 'user-1',
        email: 'admin@example.com',
        fullName: 'Admin User',
        role: 'ADMIN',
      }),
    );
  });

  it('loads users, updates role, and blocks a user', async () => {
    mockedApiRequest.mockImplementation(async (path: string, options?: { method?: string; body?: unknown }) => {
      if (path === '/admin/users') {
        return MANAGED_USERS;
      }

      if (path === '/admin/users/user-2' && options?.method === 'PATCH') {
        const body = options.body as { role?: string; isBlocked?: boolean };
        return {
          ...MANAGED_USERS[1],
          role: body.role ?? MANAGED_USERS[1].role,
          isBlocked: body.isBlocked ?? MANAGED_USERS[1].isBlocked,
          updatedAt: '2026-04-07T10:00:00.000Z',
        };
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    renderPage();

    await screen.findByText('Platform users');
    const juryCard = screen.getByText('Jury User').closest('.admin-user-card');
    expect(juryCard).not.toBeNull();

    const roleSelect = within(juryCard as HTMLElement).getByLabelText('New role');
    fireEvent.change(roleSelect, { target: { value: 'ORGANIZER' } });
    fireEvent.click(within(juryCard as HTMLElement).getByRole('button', { name: 'Save role' }));

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith('/admin/users/user-2', {
        method: 'PATCH',
        body: { role: 'ORGANIZER' },
      });
    });

    await screen.findByText('Updated the role for Jury User.');

    fireEvent.click(within(juryCard as HTMLElement).getByRole('button', { name: 'Block user' }));

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith('/admin/users/user-2', {
        method: 'PATCH',
        body: { isBlocked: true },
      });
    });

    await screen.findByText('Blocked Jury User.');
  });
});
