import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

function renderMessagesPage(initialEntry = '/app/messages') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
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
            tournamentId: null,
            title: 'Round starts tomorrow',
            body: 'Prepare repository and demo links.',
            audience: 'TEAM',
            visibility: 'AUTHENTICATED',
            linkUrl: null,
            isPinned: true,
            isActive: true,
            publishedAt: '2026-03-22T10:00:00.000Z',
            createdAt: '2026-03-22T10:00:00.000Z',
            updatedAt: '2026-03-22T10:00:00.000Z',
            isUnread: true,
          },
        ];
      }

      if (path === '/announcements/read-state') {
        return {
          lastAnnouncementsReadAt: '2026-03-22T10:00:00.000Z',
        };
      }

      if (path === '/notifications') {
        return [];
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
          tournamentId: null,
          title: 'Platform update',
          body: 'Registration deadline moved by one day.',
          audience: 'ALL',
          visibility: 'AUTHENTICATED',
          linkUrl: null,
          isPinned: false,
          isActive: true,
          publishedAt: '2026-03-22T10:00:00.000Z',
          createdAt: '2026-03-22T10:00:00.000Z',
          updatedAt: '2026-03-22T10:00:00.000Z',
          isUnread: false,
        };
      }

      if (path === '/announcements') {
        return [];
      }

      if (path === '/tournaments') {
        return [];
      }

      if (path === '/notifications') {
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
          visibility: 'AUTHENTICATED',
          isPinned: false,
          isActive: true,
        },
      });
    });

    expect(screen.getByText('Announcement created.')).toBeInTheDocument();
  });

  it('uses Ukrainian spellcheck hints for message and announcement text fields', async () => {
    localStorage.setItem('falconarena_language', 'uk');
    mockedApiRequest.mockImplementation(async (path: string) => {
      if (path === '/auth/me') {
        return {
          id: 'admin-1',
          email: 'admin@example.com',
          fullName: 'Admin User',
          role: 'ADMIN',
        };
      }

      if (path === '/announcements') {
        return [];
      }

      if (path === '/tournaments') {
        return [];
      }

      if (path === '/notifications') {
        return [];
      }

      if (path === '/messages/dialogs') {
        return [
          {
            id: 'dialog-1',
            createdAt: '2026-03-22T10:00:00.000Z',
            updatedAt: '2026-03-22T10:00:00.000Z',
            otherUser: {
              id: 'team-1',
              email: 'team@example.com',
              fullName: 'Team User',
              role: 'TEAM',
            },
            lastMessage: null,
            isUnread: false,
          },
        ];
      }

      if (path === '/messages/dialogs/dialog-1') {
        return {
          dialog: {
            id: 'dialog-1',
            createdAt: '2026-03-22T10:00:00.000Z',
            updatedAt: '2026-03-22T10:00:00.000Z',
            otherUser: {
              id: 'team-1',
              email: 'team@example.com',
              fullName: 'Team User',
              role: 'TEAM',
            },
            lastMessage: null,
            isUnread: false,
          },
          messages: [],
        };
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    renderMessagesPage();

    await screen.findByText('Керування оголошеннями');

    const announcementForm = document.getElementById('messages-announcements-manage');
    const announcementTitle = announcementForm?.querySelector(
      'input[maxlength="140"]',
    ) as HTMLInputElement;
    const announcementBody = announcementForm?.querySelector('textarea') as HTMLTextAreaElement;

    expect(document.documentElement).toHaveAttribute('lang', 'uk-UA');
    expect(announcementTitle).toHaveAttribute('lang', 'uk-UA');
    expect(announcementTitle).toHaveAttribute('spellcheck', 'true');
    expect(announcementBody).toHaveAttribute('lang', 'uk-UA');
    expect(announcementBody).toHaveAttribute('spellcheck', 'true');

    const messageComposer = await screen.findByPlaceholderText('Повідомлення');
    expect(messageComposer).toHaveAttribute('lang', 'uk-UA');
    expect(messageComposer).toHaveAttribute('spellcheck', 'true');
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

      if (path === '/notifications') {
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
            isUnread: false,
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
            isUnread: false,
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
            isUnread: false,
          },
          messages: [],
        };
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    renderMessagesPage();

    await screen.findByRole('heading', { name: 'Personal dialogs', level: 2 });

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

  it('shows unread dialogs count for unopened conversations', async () => {
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
        return [];
      }

      if (path === '/announcements/read-state') {
        return {
          lastAnnouncementsReadAt: '2026-03-22T10:00:00.000Z',
        };
      }

      if (path === '/notifications') {
        return [];
      }

      if (path === '/messages/dialogs') {
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
            isUnread: false,
          },
          {
            id: 'dialog-2',
            createdAt: '2026-03-22T09:00:00.000Z',
            updatedAt: '2026-03-22T11:30:00.000Z',
            otherUser: {
              id: 'admin-1',
              email: 'admin@example.com',
              fullName: 'Admin User',
              role: 'ADMIN',
            },
            lastMessage: {
              id: 'message-2',
              conversationId: 'dialog-2',
              senderId: 'admin-1',
              body: 'Please review the latest announcement.',
              createdAt: '2026-03-22T11:30:00.000Z',
              updatedAt: '2026-03-22T11:30:00.000Z',
            },
            isUnread: true,
          },
        ];
      }

      if (path === '/messages/dialogs/dialog-1') {
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
            isUnread: false,
          },
          messages: [],
        };
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    renderMessagesPage();

    await screen.findByText('Unread dialogs');

    const unreadSummaryCard = screen.getByText('Unread dialogs').closest('.summary-card');
    expect(unreadSummaryCard).not.toBeNull();
    expect(within(unreadSummaryCard as HTMLElement).getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Please review the latest announcement.')).toBeInTheDocument();
    expect(screen.getAllByText('New').length).toBeGreaterThan(0);
  });

  it('opens notification section from query parameter and highlights the target item', async () => {
    mockedApiRequest.mockImplementation(async (path: string) => {
      if (path === '/auth/me') {
        return {
          id: 'team-1',
          email: 'team@example.com',
          fullName: 'Team User',
          role: 'TEAM',
        };
      }

      if (path === '/notifications') {
        return [
          {
            id: 'notification-1',
            type: 'ROUND_STARTED',
            title: 'Round is active',
            body: 'Upload your submission before the deadline.',
            linkUrl: '/app/tournaments/t-1',
            createdAt: '2026-03-22T12:00:00.000Z',
            isUnread: true,
          },
        ];
      }

      if (path === '/notifications/read-state') {
        return {
          readAt: '2026-03-22T12:00:00.000Z',
          updated: 1,
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

    renderMessagesPage('/app/messages?section=notifications&notification=notification-1');

    await screen.findByRole('heading', { name: 'System notifications', level: 2 });
    expect(screen.getByText('Round is active')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notifications' })).toHaveClass('active');
  });
});
