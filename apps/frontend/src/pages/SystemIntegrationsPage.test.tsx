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

  it('loads Google Sheets settings and normalizes empty values on save and test', async () => {
    mockedApiRequest.mockImplementation(async (path: string, options?: { method?: string; body?: unknown }) => {
      if (path === '/admin/system-integrations/google-sheets' && !options?.method) {
        return {
          webhookUrl: 'https://script.google.com/macros/s/example/exec',
          secret: '',
          defaultSheetName: '',
          isConfigured: true,
          lastCheckedAt: null,
          lastCheckStatus: null,
          lastCheckMessage: null,
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

      throw new Error(`Unexpected request: ${path}`);
    });

    renderPage();

    expect(await screen.findByDisplayValue('https://script.google.com/macros/s/example/exec')).toBeInTheDocument();

    fireEvent.change(
      screen.getByDisplayValue('https://script.google.com/macros/s/example/exec'),
      {
        target: { value: 'https://script.google.com/macros/s/updated/exec' },
      },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText('Integration settings were saved.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
    const successMessages = await screen.findAllByText('Connection test passed successfully');
    expect(successMessages.length).toBeGreaterThan(0);
  });
});
