import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { apiRequest } from '../lib/api';
import MonitoringPage from './MonitoringPage';

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
    <MemoryRouter initialEntries={['/app/monitoring']}>
      <I18nProvider>
        <MonitoringPage />
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('MonitoringPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('falconarena_language', 'en');
  });

  it('loads monitoring data and supports refresh', async () => {
    mockedApiRequest.mockImplementation(async (path: string) => {
      if (path === '/admin/error-reports?limit=25') {
        return [
          {
            id: 'report-1',
            requestId: 'req-123',
            method: 'POST',
            path: '/rounds/round-1/activate',
            statusCode: 500,
            message: 'Round activation failed',
            stack: 'Error: Round activation failed',
            userId: 'admin-1',
            userRole: 'ADMIN',
            userEmail: 'admin@falconarena.live',
            createdAt: '2026-03-31T10:00:00.000Z',
          },
        ];
      }

      if (path === '/admin/system-integrations/google-sheets') {
        return {
          isConfigured: true,
          lastExportAt: '2026-03-31T09:00:00.000Z',
          lastExportStatus: 'success',
        };
      }

      if (path === '/admin/system-integrations/email') {
        return {
          enabled: true,
          isConfigured: true,
          lastCheckedAt: '2026-03-31T09:30:00.000Z',
          lastCheckStatus: 'sent',
        };
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    renderPage();

    expect(await screen.findByText('Monitoring')).toBeInTheDocument();
    expect(screen.getByText('Round activation failed')).toBeInTheDocument();
    expect(screen.getAllByText('1 incidents').length).toBeGreaterThan(0);
    expect(screen.getByText('System signal board')).toBeInTheDocument();
    expect(screen.getByText('req-123')).toBeInTheDocument();
    expect(screen.getByText('admin@falconarena.live')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Critical' }));
    expect(screen.getByText('Round activation failed')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(await screen.findByText('Round activation failed')).toBeInTheDocument();
    expect(mockedApiRequest).toHaveBeenCalledWith('/admin/error-reports?limit=25');
  });
});
