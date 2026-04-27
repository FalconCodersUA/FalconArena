import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import OAuthCallbackPage from './OAuthCallbackPage';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function renderOAuthCallbackPage(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <I18nProvider>
        <Routes>
          <Route path="/app/oauth/callback" element={<OAuthCallbackPage />} />
          <Route path="/app/login" element={<div>Login page</div>} />
        </Routes>
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('OAuthCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('falconarena_language', 'en');
  });

  it('stores OAuth auth payload and redirects to dashboard', async () => {
    const user = encodeURIComponent(
      JSON.stringify({
        id: 'team-user-1',
        email: 'team@example.com',
        fullName: 'Team User',
        role: 'TEAM',
      }),
    );

    renderOAuthCallbackPage(`/app/oauth/callback?accessToken=oauth-token&user=${user}`);

    await waitFor(() => {
      expect(localStorage.getItem('falconarena_access_token')).toBe('oauth-token');
    });

    expect(localStorage.getItem('falconarena_auth_user')).toContain('team@example.com');
    expect(navigateMock).toHaveBeenCalledWith('/app/dashboard', { replace: true });
  });

  it('shows an error state when OAuth callback fails', async () => {
    renderOAuthCallbackPage('/app/oauth/callback?error=Account%20is%20blocked');

    expect(await screen.findByText('Could not complete sign-in')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      '/app/login',
    );
  });
});
