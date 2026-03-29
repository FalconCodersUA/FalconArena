import { afterEach, describe, expect, it, vi } from 'vitest';
import { SystemIntegrationsService } from './system-integrations.service';

function createPrismaMock() {
  return {
    systemIntegrationSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  };
}

describe('SystemIntegrationsService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    delete process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;
    delete process.env.GOOGLE_SHEETS_DEFAULT_SHEET_NAME;
  });

  it('returns database-backed Google Sheets settings', async () => {
    const prisma = createPrismaMock();
    prisma.systemIntegrationSettings.findUnique.mockResolvedValue({
      id: 'default',
      googleSheetsWebhookUrl: 'https://script.google.com/macros/s/example/exec',
      googleSheetsWebhookSecret: 'secret',
      googleSheetsDefaultSheetName: 'FalconArena Export',
      googleSheetsLastCheckedAt: new Date('2026-03-29T18:00:00.000Z'),
      googleSheetsLastCheckStatus: 'connected',
      googleSheetsLastCheckMessage: 'ok',
    });

    const service = new SystemIntegrationsService(prisma as never);
    const result = await service.getGoogleSheetsSettings();

    expect(result).toMatchObject({
      webhookUrl: 'https://script.google.com/macros/s/example/exec',
      secret: 'secret',
      defaultSheetName: 'FalconArena Export',
      isConfigured: true,
      lastCheckStatus: 'connected',
      lastCheckMessage: 'ok',
      source: 'database',
    });
  });

  it('updates Google Sheets settings in the database', async () => {
    const prisma = createPrismaMock();
    prisma.systemIntegrationSettings.findUnique.mockResolvedValue({
      id: 'default',
      googleSheetsWebhookUrl: 'https://script.google.com/macros/s/example/exec',
      googleSheetsWebhookSecret: 'new-secret',
      googleSheetsDefaultSheetName: 'FalconArena Export',
      googleSheetsLastCheckedAt: null,
      googleSheetsLastCheckStatus: null,
      googleSheetsLastCheckMessage: null,
    });

    const service = new SystemIntegrationsService(prisma as never);
    await service.updateGoogleSheetsSettings(
      {
        webhookUrl: 'https://script.google.com/macros/s/example/exec',
        secret: 'new-secret',
        defaultSheetName: 'FalconArena Export',
      },
      'admin-1',
    );

    expect(prisma.systemIntegrationSettings.upsert).toHaveBeenCalledWith({
      where: { id: 'default' },
      update: {
        googleSheetsWebhookUrl: 'https://script.google.com/macros/s/example/exec',
        googleSheetsWebhookSecret: 'new-secret',
        googleSheetsDefaultSheetName: 'FalconArena Export',
        updatedByUserId: 'admin-1',
      },
      create: {
        id: 'default',
        googleSheetsWebhookUrl: 'https://script.google.com/macros/s/example/exec',
        googleSheetsWebhookSecret: 'new-secret',
        googleSheetsDefaultSheetName: 'FalconArena Export',
        updatedByUserId: 'admin-1',
      },
    });
  });

  it('tests Google Sheets connection and stores successful status', async () => {
    const prisma = createPrismaMock();
    prisma.systemIntegrationSettings.upsert.mockResolvedValue({
      id: 'default',
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new SystemIntegrationsService(prisma as never);
    const result = await service.testGoogleSheetsConnection(
      {
        webhookUrl: 'https://script.google.com/macros/s/example/exec',
        secret: 'secret',
        defaultSheetName: 'FalconArena Export',
      },
      {
        userId: 'admin-1',
        email: 'admin@example.com',
        role: 'ADMIN',
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://script.google.com/macros/s/example/exec',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-falconarena-export-secret': 'secret',
        }),
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      status: 'connected',
      message: 'Connection test passed successfully',
    });
    expect(prisma.systemIntegrationSettings.upsert).toHaveBeenCalled();
  });
});
