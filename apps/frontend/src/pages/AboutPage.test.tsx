import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { apiRequest } from '../lib/api';
import AboutPage from './AboutPage';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

const mockedApiRequest = vi.mocked(apiRequest);

function createAboutContent() {
  return {
    hero: {
      eyebrow: { uk: 'Про продукт', en: 'About product' },
      title: { uk: 'Про FalconArena', en: 'About FalconArena' },
      description: {
        uk: 'Публічний опис платформи для командних турнірів.',
        en: 'Public platform description for team tournaments.',
      },
      bannerImageUrl: '/uploads/about/banner.png',
    },
    product: {
      eyebrow: { uk: 'Процес', en: 'Process' },
      title: { uk: 'Керований турнірний маршрут', en: 'Managed tournament route' },
      lead: {
        uk: 'Опис картки робочого процесу.',
        en: 'Workflow card description.',
      },
    },
    roles: {
      label: { uk: 'Ролі платформи', en: 'Platform roles' },
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
      title: { uk: 'Почніть роботу', en: 'Start working' },
      lead: { uk: 'Опис нижнього блоку.', en: 'Bottom block description.' },
      registerLabel: { uk: 'Створити акаунт команди', en: 'Create team account' },
      workspaceLabel: { uk: 'Відкрити робочий простір', en: 'Open workspace' },
    },
    contacts: {
      eyebrow: { uk: 'Контакти', en: 'Contacts' },
      title: { uk: 'Наші канали', en: 'Our channels' },
      lead: { uk: 'Напишіть нам у зручному каналі.', en: 'Reach us through a convenient channel.' },
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
      ],
    },
    source: 'database',
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/app/about']}>
      <I18nProvider>
        <AboutPage />
      </I18nProvider>
    </MemoryRouter>,
  );
}

function createPublicReviews() {
  return [
    {
      id: 'review-1',
      text: 'FalconArena helped our team follow tournament deadlines without extra chats.',
      authorName: 'Team Captain',
      authorRole: 'TEAM',
      reviewedAt: '2026-04-21T09:00:00.000Z',
      createdAt: '2026-04-21T08:00:00.000Z',
    },
  ];
}

describe('AboutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('falconarena_language', 'uk');
  });

  it('renders saved platform content from the public endpoint', async () => {
    mockedApiRequest.mockResolvedValue(createAboutContent());

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Про FalconArena' })).toBeInTheDocument();
    expect(
      screen.getByText('Публічний опис платформи для командних турнірів.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Керований турнірний маршрут' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Дивитися презентацію' })).toHaveAttribute(
      'href',
      '/app/presentation',
    );
    expect(screen.getByRole('img', { name: 'Про FalconArena' })).toHaveAttribute(
      'src',
      'https://falconarena.live/uploads/about/banner.png',
    );
    expect(screen.getByRole('heading', { name: 'Організатори' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Команди' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Журі' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Наші канали' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Telegram @falconarena_team' })).toHaveAttribute(
      'href',
      'https://t.me/falconarena_team',
    );
    expect(mockedApiRequest).toHaveBeenCalledWith('/platform/about');
  });

  it('renders saved English platform content when English language is selected', async () => {
    localStorage.setItem('falconarena_language', 'en');
    mockedApiRequest.mockResolvedValue(createAboutContent());

    renderPage();

    expect(await screen.findByRole('heading', { name: 'About FalconArena' })).toBeInTheDocument();
    expect(screen.getByText('Public platform description for team tournaments.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Managed tournament route' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Organizers' })).toBeInTheDocument();
  });

  it('keeps fallback copy when the public endpoint is unavailable', async () => {
    mockedApiRequest.mockRejectedValue(new Error('Network error'));

    renderPage();

    expect(
      await screen.findByRole('heading', {
        name: 'FalconArena - вебплатформа для командних турнірів з програмування',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'FalconArena допомагає організаторам проводити командні турніри з програмування в одному робочому просторі. Платформа обʼєднує реєстрацію команд, керування раундами, подання робіт, оцінювання журі, лідерборд, повідомлення та експорт результатів.',
      ),
    ).toBeInTheDocument();
  });

  it('renders the guest CTA without removed promotional blocks', async () => {
    mockedApiRequest.mockResolvedValue(createAboutContent());

    renderPage();

    await screen.findByRole('heading', { name: 'Про FalconArena' });

    expect(screen.queryByText('3 робочі контури')).not.toBeInTheDocument();
    expect(screen.queryByText('Контроль над турніром')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Один турнірний маршрут без зайвих перемикань'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Переглянути турніри' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Створити акаунт команди' }),
    ).toHaveAttribute('href', '/app/register');
    expect(screen.getByText('Капітан команди')).toBeInTheDocument();
  });

  it('routes the CTA to tournaments for signed-in users', async () => {
    localStorage.setItem('falconarena_access_token', 'test-token');
    localStorage.setItem(
      'falconarena_auth_user',
      JSON.stringify({
        id: 'team-user',
        email: 'team@example.com',
        fullName: 'Team User',
        role: 'TEAM',
      }),
    );
    mockedApiRequest.mockResolvedValue(createAboutContent());

    renderPage();

    await screen.findByRole('heading', { name: 'Про FalconArena' });

    expect(
      screen.getByRole('link', { name: 'Відкрити робочий простір' }),
    ).toHaveAttribute('href', '/app/tournaments');
    expect(screen.queryByRole('link', { name: 'Створити акаунт команди' })).not.toBeInTheDocument();
  });

  it('renders approved reviews and submits a signed-in user review for moderation', async () => {
    localStorage.setItem('falconarena_access_token', 'test-token');
    localStorage.setItem(
      'falconarena_auth_user',
      JSON.stringify({
        id: 'team-user',
        email: 'team@example.com',
        fullName: 'Team User',
        role: 'TEAM',
      }),
    );
    mockedApiRequest.mockImplementation(async (path, options) => {
      if (path === '/platform/about') {
        return createAboutContent();
      }

      if (path === '/platform/about/reviews' && !options?.method) {
        return createPublicReviews();
      }

      if (path === '/platform/about/reviews' && options?.method === 'POST') {
        expect(options.body).toEqual({
          text: 'FalconArena made tournament work easier for our team.',
        });

        return {
          id: 'review-2',
          text: 'FalconArena made tournament work easier for our team.',
          status: 'PENDING',
          authorName: 'Team User',
          authorRole: 'TEAM',
          reviewedAt: null,
          updatedAt: '2026-04-21T10:00:00.000Z',
        };
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    renderPage();

    expect(
      await screen.findByText(
        'FalconArena helped our team follow tournament deadlines without extra chats.',
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Написати відгук' }));
    expect(screen.getByRole('dialog', { name: 'Написати відгук' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Ваш відгук'), {
      target: { value: 'FalconArena made tournament work easier for our team.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Надіслати відгук' }));

    expect(await screen.findByText('Відгук надіслано на модерацію.')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith('/platform/about/reviews', {
        method: 'POST',
        body: {
          text: 'FalconArena made tournament work easier for our team.',
        },
      });
    });
  });
});
