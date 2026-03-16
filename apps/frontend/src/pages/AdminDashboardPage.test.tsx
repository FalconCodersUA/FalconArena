import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    <I18nProvider>
      <AdminDashboardPage />
    </I18nProvider>,
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

    await screen.findByRole('heading', { name: 'Create user' });

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Jury User' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jury@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'strongpass123' } });
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'JURY' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create user' }));

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

    expect(screen.getByText('User with the Jury role was created successfully.')).toBeInTheDocument();
  });

  it('hides ADMIN role option for organizer', async () => {
    mockedApiRequest.mockImplementation(async (path: string) => {
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

    await screen.findByRole('heading', { name: 'Create user' });

    const roleSelect = screen.getByLabelText('Role') as HTMLSelectElement;
    const options = Array.from(roleSelect.options).map((option) => option.value);

    expect(options).toEqual(['JURY', 'ORGANIZER', 'TEAM']);
  });
});
