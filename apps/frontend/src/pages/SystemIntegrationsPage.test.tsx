import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { apiRequest } from '../lib/api';
import SystemIntegrationsPage from './SystemIntegrationsPage';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

const mockedApiRequest = vi.mocked(apiRequest);

function createPlatformContent() {
  return {
    hero: {
      eyebrow: { uk: 'Про платформу', en: 'About the platform' },
      title: {
        uk: 'Про FalconArena',
        en: 'About FalconArena',
      },
      description: {
        uk: 'Публічний опис платформи.',
        en: 'Initial public platform description.',
      },
      bannerImageUrl: '/uploads/about/banner.png',
    },
    product: {
      eyebrow: { uk: 'Процес', en: 'Process' },
      title: { uk: 'Маршрут турніру', en: 'Tournament route' },
      lead: { uk: 'Опис процесу.', en: 'Workflow description.' },
    },
    roles: {
      label: { uk: 'Ролі', en: 'Roles' },
      organizers: {
        title: { uk: 'Організатори', en: 'Organizers' },
        lead: { uk: 'Опис організаторів.', en: 'Organizers description.' },
      },
      teams: {
        title: { uk: 'Команди', en: 'Teams' },
        lead: { uk: 'Опис команд.', en: 'Teams description.' },
      },
      jury: {
        title: { uk: 'Журі', en: 'Jury' },
        lead: { uk: 'Опис журі.', en: 'Jury description.' },
      },
    },
    cta: {
      eyebrow: { uk: 'Старт', en: 'Start' },
      title: { uk: 'Почати роботу', en: 'Start working' },
      lead: { uk: 'Опис CTA.', en: 'CTA description.' },
      registerLabel: { uk: 'Створити акаунт команди', en: 'Create team account' },
      workspaceLabel: { uk: 'Відкрити робочий простір', en: 'Open workspace' },
    },
    contacts: {
      eyebrow: { uk: 'Контакти', en: 'Contacts' },
      title: { uk: 'Наші канали', en: 'Our channels' },
      lead: { uk: 'Напишіть нам.', en: 'Reach us.' },
      items: [
        {
          label: { uk: 'Telegram', en: 'Telegram' },
          value: { uk: '@falconarena_team', en: '@falconarena_team' },
          url: 'https://t.me/falconarena_team',
        },
        {
          label: { uk: 'GitHub', en: 'GitHub' },
          value: { uk: 'github.com/falconarena', en: 'github.com/falconarena' },
          url: 'https://github.com/falconarena',
        },
        {
          label: { uk: 'Email', en: 'Email' },
          value: { uk: 'team@falconarena.live', en: 'team@falconarena.live' },
          url: 'mailto:team@falconarena.live',
        },
        {
          label: { uk: 'LinkedIn', en: 'LinkedIn' },
          value: { uk: 'FalconArena', en: 'FalconArena' },
          url: 'https://www.linkedin.com',
        },
      ],
    },
    source: 'database',
  };
}

function createSettingsMock({
  platformContentError = false,
}: {
  platformContentError?: boolean;
} = {}) {
  return async (path: string, options?: { method?: string; body?: unknown }) => {
    if (path === '/admin/system-integrations/google-sheets' && !options?.method) {
      return {
        webhookUrl: 'https://script.google.com/macros/s/example/exec',
        secret: '',
        defaultSheetName: '',
        isConfigured: true,
        lastCheckedAt: null,
        lastCheckStatus: null,
        lastCheckMessage: null,
        lastExportAt: null,
        lastExportStatus: null,
        lastExportMessage: null,
        lastExportUrl: null,
        source: 'database',
      };
    }

    if (path === '/admin/system-integrations/email' && !options?.method) {
      return {
        enabled: true,
        provider: 'console',
        from: 'no-reply@falconarena.live',
        replyTo: 'team@falconarena.live',
        resendApiKey: '',
        isConfigured: true,
        lastCheckedAt: null,
        lastCheckStatus: null,
        lastCheckMessage: null,
        source: 'database',
      };
    }

    if (path === '/admin/system-integrations/notification-rules' && !options?.method) {
      return {
        registrationStarted: true,
        roundStarted: true,
        submissionReceived: true,
        deadlineReminder: true,
        submissionClosed: true,
        source: 'database',
      };
    }

    if (path === '/admin/system-integrations/tournament-defaults' && !options?.method) {
      return {
        minTeamMembers: 2,
        maxTeamMembers: 8,
        defaultMinReviewersPerSubmission: 2,
        defaultProjectTimeZone: 'Europe/Kyiv',
        hideTeamsUntilRegistrationClose: true,
        defaultTournamentMaxTeams: 24,
        defaultRegistrationWindowHours: 48,
        defaultRoundDurationHours: 72,
        defaultTournamentDescription: 'Default tournament description',
        defaultRoundDescription: 'Default round description',
        source: 'database',
      };
    }

    if (path === '/admin/system-integrations/platform-content' && !options?.method) {
      if (platformContentError) {
        throw new Error('Cannot GET /admin/system-integrations/platform-content');
      }

      return {
        ...createPlatformContent(),
      };
    }

    if (path === '/admin/system-integrations/platform-content' && options?.method === 'PATCH') {
      expect(
        (
          options.body as {
            hero: { description: { en: string }; bannerImageUrl: string | null };
            contacts: { items: Array<{ url: string | null }> };
          }
        ),
      ).toMatchObject({
        hero: {
          description: {
            en: 'Updated public platform description.',
          },
          bannerImageUrl: '/uploads/about/banner.png',
        },
        contacts: {
          items: expect.arrayContaining([
            expect.objectContaining({
              url: 'https://t.me/falconarena_team',
            }),
          ]),
        },
      });

      return {
        ...createPlatformContent(),
        hero: {
          ...createPlatformContent().hero,
          description: {
            uk: 'Публічний опис платформи.',
            en: 'Updated public platform description.',
          },
        },
        source: 'database',
      };
    }

    if (path === '/admin/system-integrations/google-sheets' && options?.method === 'PATCH') {
      expect(options.body).toEqual({
        webhookUrl: 'https://script.google.com/macros/s/updated/exec',
        secret: undefined,
        defaultSheetName: undefined,
      });

      return {
        webhookUrl: 'https://script.google.com/macros/s/updated/exec',
        secret: '',
        defaultSheetName: '',
        isConfigured: true,
        lastCheckedAt: null,
        lastCheckStatus: null,
        lastCheckMessage: null,
        lastExportAt: null,
        lastExportStatus: null,
        lastExportMessage: null,
        lastExportUrl: null,
        source: 'database',
      };
    }

    if (path === '/admin/system-integrations/google-sheets/test' && options?.method === 'POST') {
      expect(options.body).toEqual({
        webhookUrl: 'https://script.google.com/macros/s/updated/exec',
        secret: undefined,
        defaultSheetName: undefined,
      });

      return {
        ok: true,
        status: 'connected',
        message: 'Connection test passed successfully',
        checkedAt: '2026-03-29T19:00:00.000Z',
      };
    }

    if (path === '/admin/system-integrations/email' && options?.method === 'PATCH') {
      expect(options.body).toEqual({
        enabled: true,
        provider: 'resend',
        from: 'alerts@falconarena.live',
        replyTo: 'team@falconarena.live',
        resendApiKey: 'resend-key',
      });

      return {
        enabled: true,
        provider: 'resend',
        from: 'alerts@falconarena.live',
        replyTo: 'team@falconarena.live',
        resendApiKey: 'resend-key',
        isConfigured: true,
        lastCheckedAt: null,
        lastCheckStatus: null,
        lastCheckMessage: null,
        source: 'database',
      };
    }

    if (path === '/admin/system-integrations/email/test' && options?.method === 'POST') {
      expect(options.body).toEqual({
        recipientEmail: 'ops@falconarena.live',
      });

      return {
        ok: true,
        status: 'sent',
        message: 'Test email sent to ops@falconarena.live',
        checkedAt: '2026-03-29T19:30:00.000Z',
      };
    }

    if (path === '/admin/system-integrations/notification-rules' && options?.method === 'PATCH') {
      expect(options.body).toEqual({
        registrationStarted: true,
        roundStarted: false,
        submissionReceived: true,
        deadlineReminder: true,
        submissionClosed: true,
      });

      return {
        registrationStarted: true,
        roundStarted: false,
        submissionReceived: true,
        deadlineReminder: true,
        submissionClosed: true,
        source: 'database',
      };
    }

    if (path === '/admin/system-integrations/tournament-defaults' && options?.method === 'PATCH') {
      expect(options.body).toEqual({
        minTeamMembers: 2,
        maxTeamMembers: 10,
        defaultMinReviewersPerSubmission: 2,
        defaultProjectTimeZone: 'Europe/Kyiv',
        hideTeamsUntilRegistrationClose: true,
        defaultTournamentMaxTeams: 24,
        defaultRegistrationWindowHours: 48,
        defaultRoundDurationHours: 72,
        defaultTournamentDescription: 'Default tournament description',
        defaultRoundDescription: 'Default round description',
      });

      return {
        minTeamMembers: 2,
        maxTeamMembers: 10,
        defaultMinReviewersPerSubmission: 2,
        defaultProjectTimeZone: 'Europe/Kyiv',
        hideTeamsUntilRegistrationClose: true,
        defaultTournamentMaxTeams: 24,
        defaultRegistrationWindowHours: 48,
        defaultRoundDurationHours: 72,
        defaultTournamentDescription: 'Default tournament description',
        defaultRoundDescription: 'Default round description',
        source: 'database',
      };
    }

    throw new Error(`Unexpected request: ${path}`);
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/app/integrations']}>
      <I18nProvider>
        <SystemIntegrationsPage />
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('SystemIntegrationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('falconarena_language', 'en');
  });

  it('loads integrations settings and saves Google Sheets, email, and notification rules', async () => {
    mockedApiRequest.mockImplementation(createSettingsMock());

    renderPage();

    expect(await screen.findByDisplayValue('https://script.google.com/macros/s/example/exec')).toBeInTheDocument();
    expect(screen.getByDisplayValue('About FalconArena')).toBeInTheDocument();
    expect(screen.getByDisplayValue('/uploads/about/banner.png')).toBeInTheDocument();
    expect(screen.getByLabelText('Upload from computer')).toHaveAttribute(
      'type',
      'file',
    );
    expect(screen.getByDisplayValue('Tournament route')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Open workspace')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Our channels')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('@falconarena_team').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByDisplayValue('Initial public platform description.'), {
      target: { value: 'Updated public platform description.' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save settings' })[4]);
    expect(await screen.findByText('Integration settings were saved.')).toBeInTheDocument();

    fireEvent.change(
      screen.getByDisplayValue('https://script.google.com/macros/s/example/exec'),
      {
        target: { value: 'https://script.google.com/macros/s/updated/exec' },
      },
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Save settings' })[0]);
    expect(await screen.findByText('Integration settings were saved.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
    const successMessages = await screen.findAllByText('Connection test passed successfully');
    expect(successMessages.length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Sender email'), {
      target: { value: 'alerts@falconarena.live' },
    });
    fireEvent.change(screen.getByLabelText('Reply-To'), {
      target: { value: 'team@falconarena.live' },
    });
    fireEvent.change(screen.getByLabelText('Email provider'), {
      target: { value: 'resend' },
    });
    fireEvent.change(screen.getByLabelText('Resend API key'), {
      target: { value: 'resend-key' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save settings' })[1]);
    expect((await screen.findAllByText('Integration settings were saved.')).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Test recipient email'), {
      target: { value: 'ops@falconarena.live' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send test email' }));
    expect(
      (await screen.findAllByText('Test email sent to ops@falconarena.live')).length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Round started' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Save settings' })[3]);
    expect((await screen.findAllByText('Integration settings were saved.')).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByDisplayValue('8'), {
      target: { value: '10' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save settings' })[2]);
    expect((await screen.findAllByText('Integration settings were saved.')).length).toBeGreaterThan(0);
  });

  it('keeps integrations available when platform content endpoint is missing', async () => {
    mockedApiRequest.mockImplementation(createSettingsMock({ platformContentError: true }));

    renderPage();

    expect(await screen.findByDisplayValue('https://script.google.com/macros/s/example/exec')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('FalconArena - a web platform for team programming tournaments'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'The platform content endpoint is not available yet. The system fallback is shown; saving will work after the updated backend is running.',
      ),
    ).toBeInTheDocument();
  });
});
