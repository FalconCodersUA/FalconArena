import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { apiRequest } from '../lib/api';
import RegisterPage from './RegisterPage';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

const mockedApiRequest = vi.mocked(apiRequest);

function renderRegisterPage() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <RegisterPage />
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('falconarena_language', 'en');
  });

  it('shows validation error when passwords do not match', async () => {
    renderRegisterPage();

    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'New' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'User' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'strongpass123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'differentpass123' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });

  it('registers a TEAM account and redirects to team workspace', async () => {
    mockedApiRequest.mockResolvedValue({
      accessToken: 'test-token',
      user: {
        id: 'team-user-1',
        email: 'new@example.com',
        fullName: 'New User',
        role: 'TEAM',
      },
    });

    renderRegisterPage();

    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'New' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'User' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'strongpass123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'strongpass123' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith('/auth/register', {
        method: 'POST',
        body: {
          fullName: 'New User',
          email: 'new@example.com',
          password: 'strongpass123',
        },
      });
    });

    expect(localStorage.getItem('falconarena_access_token')).toBe('test-token');
    expect(localStorage.getItem('falconarena_auth_user')).toContain('new@example.com');
    expect(navigateMock).toHaveBeenCalledWith('/app/team', { replace: true });
  });
});
