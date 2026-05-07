import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n/I18nProvider';
import { apiRequest } from '../../lib/api';
import AppShell from './AppShell';

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

const mockedApiRequest = vi.mocked(apiRequest);

function seedAuthedUser() {
  localStorage.setItem('falconarena_access_token', 'test-token');
  localStorage.setItem(
    'falconarena_auth_user',
    JSON.stringify({
      id: 'user-1',
      email: 'user1@example.com',
      fullName: 'User One',
      role: 'TEAM',
    }),
  );
}

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location-probe">
      {location.pathname}
      {location.search}
    </div>
  );
}

function renderShell(initialPath = '/app/tournaments') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <I18nProvider>
        <Routes>
          <Route path="/app" element={<AppShell />}>
            <Route path="dashboard" element={<div>Dashboard page</div>} />
            <Route path="tournaments" element={<div>Tournaments page</div>} />
            <Route path="about" element={<div>About page</div>} />
            <Route path="teams" element={<div>Teams page</div>} />
            <Route path="leaderboard" element={<div>Leaderboard page</div>} />
            <Route path="profile" element={<div>Profile page</div>} />
            <Route path="messages" element={<LocationProbe />} />
            <Route index element={<div>Home page</div>} />
          </Route>
        </Routes>
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('falconarena_language', 'en');
    delete document.body.dataset.theme;
    delete document.documentElement.dataset.theme;
  });

  it('shows unread badge and supports only-unread filter', async () => {
    seedAuthedUser();

    mockedApiRequest.mockImplementation(async (path: string) => {
      if (path === '/platform/defaults') {
        return {
          defaultProjectTimeZone: 'Europe/Kyiv',
        };
      }

      if (path === '/auth/me') {
        return {
          id: 'user-1',
          email: 'user1@example.com',
          fullName: 'User One',
          role: 'TEAM',
        };
      }

      if (path === '/profile/settings') {
        return {
          edit: {
            avatarUrl: '',
          },
        };
      }

      if (path === '/notifications') {
        return [
          {
            id: 'old-1',
            type: 'GENERAL',
            title: 'Old announcement',
            body: 'Old body',
            linkUrl: null,
            createdAt: '2026-03-19T10:00:00.000Z',
            isUnread: false,
          },
          {
            id: 'new-1',
            type: 'ROUND_STARTED',
            title: 'New announcement',
            body: 'New body',
            linkUrl: null,
            createdAt: '2026-03-21T10:00:00.000Z',
            isUnread: true,
          },
        ];
      }

      if (path === '/notifications/read-state') {
        return {
          readAt: '2026-03-21T10:00:00.000Z',
          updated: 1,
        };
      }

      if (path === '/messages/dialogs') {
        return [
          {
            id: 'dialog-1',
            createdAt: '2026-03-21T09:00:00.000Z',
            updatedAt: '2026-03-21T10:00:00.000Z',
            otherUser: {
              id: 'user-2',
              email: 'jury@example.com',
              fullName: 'Jury User',
              role: 'JURY',
            },
            lastMessage: {
              id: 'message-1',
              conversationId: 'dialog-1',
              senderId: 'user-2',
              body: 'Please review this update',
              createdAt: '2026-03-21T09:55:00.000Z',
              updatedAt: '2026-03-21T09:55:00.000Z',
            },
            isUnread: true,
          },
        ];
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    const view = renderShell();

    await waitFor(() => {
      const badge = view.container.querySelector('.app-topbar-alerts-badge');
      expect(badge).toBeInTheDocument();
      expect(badge?.textContent).toBe('1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    await screen.findByText('Old announcement');
    await screen.findByText('New announcement');

    fireEvent.click(screen.getByLabelText('Only unread'));

    expect(screen.queryByText('Old announcement')).not.toBeInTheDocument();
    expect(screen.getByText('New announcement')).toBeInTheDocument();
  });

  it('opens selected announcement in messages with query parameter', async () => {
    seedAuthedUser();

    mockedApiRequest.mockImplementation(async (path: string) => {
      if (path === '/platform/defaults') {
        return {
          defaultProjectTimeZone: 'Europe/Kyiv',
        };
      }

      if (path === '/auth/me') {
        return {
          id: 'user-1',
          email: 'user1@example.com',
          fullName: 'User One',
          role: 'TEAM',
        };
      }

      if (path === '/profile/settings') {
        return { edit: { avatarUrl: '' } };
      }

      if (path === '/notifications') {
        return [
          {
            id: 'new-1',
            type: 'ROUND_STARTED',
            title: 'New announcement',
            body: 'New body',
            linkUrl: null,
            createdAt: '2026-03-21T10:00:00.000Z',
            isUnread: true,
          },
        ];
      }

      if (path === '/notifications/read-state') {
        return {
          readAt: '2026-03-21T10:00:00.000Z',
          updated: 1,
        };
      }

      if (path === '/messages/dialogs') {
        return [];
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    renderShell();

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open in messages' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent(
        '/app/messages?section=notifications&notification=new-1',
      );
    });
  });

  it('cycles and persists theme mode from the topbar', async () => {
    seedAuthedUser();

    mockedApiRequest.mockImplementation(async (path: string) => {
      if (path === '/platform/defaults') {
        return {
          defaultProjectTimeZone: 'Europe/Kyiv',
        };
      }

      if (path === '/auth/me') {
        return {
          id: 'user-1',
          email: 'user1@example.com',
          fullName: 'User One',
          role: 'TEAM',
        };
      }

      if (path === '/profile/settings') {
        return { edit: { avatarUrl: '' } };
      }

      if (path === '/notifications') {
        return [];
      }

      if (path === '/messages/dialogs') {
        return [];
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    renderShell();

    const toggle = await screen.findByRole('button', { name: 'Switch to blue theme' });
    fireEvent.click(toggle);

    expect(localStorage.getItem('falconarena_theme')).toBe('blue');
    expect(document.body.dataset.theme).toBe('blue');
    expect(document.documentElement.dataset.theme).toBe('blue');
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(localStorage.getItem('falconarena_theme')).toBe('dark');
    expect(document.body.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
  });

  it('keeps the existing FalconArena brand in the sidebar shell', async () => {
    seedAuthedUser();

    mockedApiRequest.mockImplementation(async (path: string) => {
      if (path === '/platform/defaults') {
        return {
          defaultProjectTimeZone: 'Europe/Kyiv',
        };
      }

      if (path === '/auth/me') {
        return {
          id: 'user-1',
          email: 'user1@example.com',
          fullName: 'User One',
          role: 'TEAM',
        };
      }

      if (path === '/profile/settings') {
        return { edit: { avatarUrl: '' } };
      }

      if (path === '/notifications') {
        return [];
      }

      if (path === '/messages/dialogs') {
        return [];
      }

      if (path === '/tournaments') {
        return [];
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    const view = renderShell();

    await screen.findByText('Tournaments page');

    const sidebarBrand = view.container.querySelector('.app-sidebar .app-brand');
    expect(sidebarBrand).toBeInTheDocument();
    expect(sidebarBrand).toHaveTextContent('FalconArena');
    expect(view.container.querySelector('.app-topbar-brand')).not.toBeInTheDocument();
  });

  it('uses About as the public home area for guests', () => {
    const view = renderShell('/app/about');

    expect(screen.getByText('About page')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Dashboard/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Messages/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Settings/i })).not.toBeInTheDocument();
    expect(view.container.querySelector('.app-sidebar .app-brand')).toHaveAttribute(
      'href',
      '/app/about',
    );
  });

  it('renders avatar image in header after repeated sign-in mount', async () => {
    seedAuthedUser();

    mockedApiRequest.mockImplementation(async (path: string) => {
      if (path === '/platform/defaults') {
        return {
          defaultProjectTimeZone: 'Europe/Kyiv',
        };
      }

      if (path === '/auth/me') {
        return {
          id: 'user-1',
          email: 'user1@example.com',
          fullName: 'User One',
          role: 'TEAM',
        };
      }

      if (path === '/profile/settings') {
        return {
          edit: {
            avatarUrl: 'data:image/png;base64,aGVsbG8=',
          },
        };
      }

      if (path === '/notifications') {
        return [];
      }

      if (path === '/notifications/read-state') {
        return {
          readAt: '2026-03-21T10:00:00.000Z',
          updated: 0,
        };
      }

      if (path === '/messages/dialogs') {
        return [];
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    const firstMount = renderShell();
    await screen.findByAltText('Profile');
    firstMount.unmount();

    const secondMount = renderShell();
    await screen.findByAltText('Profile');
    secondMount.unmount();

    expect(
      mockedApiRequest.mock.calls.filter((call) => call[0] === '/auth/me').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('shows unread direct messages badge and opens dialogs section', async () => {
    seedAuthedUser();

    mockedApiRequest.mockImplementation(async (path: string) => {
      if (path === '/platform/defaults') {
        return {
          defaultProjectTimeZone: 'Europe/Kyiv',
        };
      }

      if (path === '/auth/me') {
        return {
          id: 'user-1',
          email: 'user1@example.com',
          fullName: 'User One',
          role: 'TEAM',
        };
      }

      if (path === '/profile/settings') {
        return { edit: { avatarUrl: '' } };
      }

      if (path === '/notifications') {
        return [];
      }

      if (path === '/messages/dialogs') {
        return [
          {
            id: 'dialog-1',
            createdAt: '2026-03-21T09:00:00.000Z',
            updatedAt: '2026-03-21T10:00:00.000Z',
            otherUser: {
              id: 'user-2',
              email: 'admin@example.com',
              fullName: 'Admin User',
              role: 'ADMIN',
            },
            lastMessage: {
              id: 'message-1',
              conversationId: 'dialog-1',
              senderId: 'user-2',
              body: 'New private message',
              createdAt: '2026-03-21T09:55:00.000Z',
              updatedAt: '2026-03-21T09:55:00.000Z',
            },
            isUnread: true,
          },
          {
            id: 'dialog-2',
            createdAt: '2026-03-20T09:00:00.000Z',
            updatedAt: '2026-03-20T10:00:00.000Z',
            otherUser: {
              id: 'user-3',
              email: 'team@example.com',
              fullName: 'Team User',
              role: 'TEAM',
            },
            lastMessage: null,
            isUnread: false,
          },
        ];
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    const view = renderShell();

    await waitFor(() => {
      const badge = view.container.querySelector('.app-topbar-mail-badge');
      expect(badge).toBeInTheDocument();
      expect(badge?.textContent).toBe('1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Direct messages' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent(
        '/app/messages?section=dialogs',
      );
    });
  });
});
