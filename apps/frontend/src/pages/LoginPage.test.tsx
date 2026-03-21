import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { apiRequest } from '../lib/api';
import LoginPage from './LoginPage';

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

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <LoginPage />
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('falconarena_language', 'en');
  });

  it('shows validation error when email is invalid', async () => {
    renderLoginPage();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'wrong-email' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });

  it('logs in and redirects to home page', async () => {
    mockedApiRequest.mockResolvedValue({
      accessToken: 'login-token',
      user: {
        id: 'team-user-1',
        email: 'new@example.com',
        fullName: 'New User',
        role: 'TEAM',
      },
    });

    renderLoginPage();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith('/auth/login', {
        method: 'POST',
        body: {
          email: 'new@example.com',
          password: 'secret123',
        },
      });
    });

    expect(localStorage.getItem('falconarena_access_token')).toBe('login-token');
    expect(localStorage.getItem('falconarena_auth_user')).toContain('new@example.com');
    expect(navigateMock).toHaveBeenCalledWith('/app/dashboard', { replace: true });
  });
});
