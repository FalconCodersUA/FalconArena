import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../i18n/I18nProvider';
import { apiRequest } from '../lib/api';
import MessagesPage from './MessagesPage';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

const mockedApiRequest = vi.mocked(apiRequest);

function renderMessagesPage() {
  return render(
    <MemoryRouter initialEntries={['/app/messages']}>
      <I18nProvider>
        <MessagesPage />
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('MessagesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('falconarena_language', 'en');
  });

  it('renders announcements for TEAM role without manager controls', async () => {
    mockedApiRequest.mockImplementation(async (path: string) => {
      if (path === '/auth/me') {
        return {
          id: 'team-1',
          email: 'team@example.com',
          fullName: 'Team User',
          role: 'TEAM',
        };
      }

      if (path === '/announcements') {
        return [
          {
            id: 'a-1',
            title: 'Round starts tomorrow',
            body: 'Prepare repository and demo links.',
            audience: 'TEAM',
            linkUrl: null,
            isPinned: true,
            isActive: true,
            publishedAt: '2026-03-22T10:00:00.000Z',
            createdAt: '2026-03-22T10:00:00.000Z',
            updatedAt: '2026-03-22T10:00:00.000Z',
          },
        ];
      }

      if (path === '/messages/dialogs') {
        return [];
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    renderMessagesPage();

    await screen.findByText('Announcement feed');
    expect(screen.getByText('Round starts tomorrow')).toBeInTheDocument();
    expect(screen.queryByText('Manage announcements')).not.toBeInTheDocument();
  });

  it('allows ADMIN to publish announcement', async () => {
    mockedApiRequest.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === '/auth/me') {
        return {
          id: 'admin-1',
          email: 'admin@example.com',
          fullName: 'Admin User',
          role: 'ADMIN',
        };
      }

      if (path === '/announcements' && options?.method === 'POST') {
        return {
          id: 'a-new',
          title: 'Platform update',
          body: 'Registration deadline moved by one day.',
          audience: 'ALL',
          linkUrl: null,
          isPinned: false,
          isActive: true,
          publishedAt: '2026-03-22T10:00:00.000Z',
          createdAt: '2026-03-22T10:00:00.000Z',
          updatedAt: '2026-03-22T10:00:00.000Z',
        };
      }

      if (path === '/announcements') {
        return [];
      }

      if (path === '/messages/dialogs') {
        return [];
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    renderMessagesPage();

    await screen.findByText('Manage announcements');

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Platform update' },
    });
    fireEvent.change(screen.getByLabelText('Announcement text'), {
      target: { value: 'Registration deadline moved by one day.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith('/announcements', {
        method: 'POST',
        body: {
          title: 'Platform update',
          body: 'Registration deadline moved by one day.',
          audience: 'ALL',
          isPinned: false,
          isActive: true,
        },
      });
    });

    expect(screen.getByText('Announcement created.')).toBeInTheDocument();
  });

  it('allows sending a direct message in selected dialog', async () => {
    mockedApiRequest.mockImplementation(async (path: string, options?: { method?: string; body?: unknown }) => {
      if (path === '/auth/me') {
        return {
          id: 'team-1',
          email: 'team@example.com',
          fullName: 'Team User',
          role: 'TEAM',
        };
      }

      if (path === '/announcements') {
        return [];
      }

      if (path === '/messages/dialogs') {
        if (options?.method === 'POST') {
          return {
            id: 'dialog-1',
            createdAt: '2026-03-22T10:00:00.000Z',
            updatedAt: '2026-03-22T10:00:00.000Z',
            otherUser: {
              id: 'jury-1',
              email: 'jury@example.com',
              fullName: 'Jury User',
              role: 'JURY',
            },
            lastMessage: null,
          };
        }

        return [
          {
            id: 'dialog-1',
            createdAt: '2026-03-22T10:00:00.000Z',
            updatedAt: '2026-03-22T10:00:00.000Z',
            otherUser: {
              id: 'jury-1',
              email: 'jury@example.com',
              fullName: 'Jury User',
              role: 'JURY',
            },
            lastMessage: null,
          },
        ];
      }

      if (path === '/messages/dialogs/dialog-1') {
        if (options?.method === 'POST') {
          return {
            id: 'message-1',
            conversationId: 'dialog-1',
            senderId: 'team-1',
            body: 'Hello jury!',
            createdAt: '2026-03-22T11:00:00.000Z',
            updatedAt: '2026-03-22T11:00:00.000Z',
          };
        }

        return {
          dialog: {
            id: 'dialog-1',
            createdAt: '2026-03-22T10:00:00.000Z',
            updatedAt: '2026-03-22T10:00:00.000Z',
            otherUser: {
              id: 'jury-1',
              email: 'jury@example.com',
              fullName: 'Jury User',
              role: 'JURY',
            },
            lastMessage: null,
          },
          messages: [],
        };
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    renderMessagesPage();

    await screen.findByText('Personal dialogs');

    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'Hello jury!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith('/messages/dialogs/dialog-1', {
        method: 'POST',
        body: {
          body: 'Hello jury!',
        },
      });
    });

    expect(screen.getByText('Message sent.')).toBeInTheDocument();
  });
});
