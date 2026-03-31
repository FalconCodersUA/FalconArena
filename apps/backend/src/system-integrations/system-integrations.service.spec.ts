import { ForbiddenException } from '@nestjs/common';
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

function createAuditLogsServiceMock() {
  return {
    record: vi.fn().mockResolvedValue(undefined),
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

    const service = new SystemIntegrationsService(
      prisma as never,
      createAuditLogsServiceMock() as never,
    );
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

    const service = new SystemIntegrationsService(
      prisma as never,
      createAuditLogsServiceMock() as never,
    );
    await service.updateGoogleSheetsSettings(
      {
        webhookUrl: 'https://script.google.com/macros/s/example/exec',
        secret: 'new-secret',
        defaultSheetName: 'FalconArena Export',
      },
      { userId: 'admin-1', role: 'ADMIN', email: 'admin@example.com' },
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

  it('returns database-backed email settings and notification rules', async () => {
    const prisma = createPrismaMock();
    prisma.systemIntegrationSettings.findUnique.mockResolvedValue({
      id: 'default',
      googleSheetsWebhookUrl: null,
      googleSheetsWebhookSecret: null,
      googleSheetsDefaultSheetName: null,
      googleSheetsLastCheckedAt: null,
      googleSheetsLastCheckStatus: null,
      googleSheetsLastCheckMessage: null,
      emailNotificationsEnabled: true,
      emailProvider: 'resend',
      emailFrom: 'no-reply@falconarena.live',
      emailReplyTo: 'team@falconarena.live',
      resendApiKey: 'resend-secret',
      emailLastCheckedAt: null,
      emailLastCheckStatus: null,
      emailLastCheckMessage: null,
      notifyRegistrationStarted: true,
      notifyRoundStarted: false,
      notifySubmissionReceived: true,
      notifyDeadlineReminder: true,
      notifySubmissionClosed: false,
      minTeamMembers: 3,
      maxTeamMembers: 6,
      defaultMinReviewersPerSubmission: 4,
      defaultProjectTimeZone: 'Europe/Warsaw',
      hideTeamsUntilRegistrationClose: false,
      defaultTournamentMaxTeams: 40,
      defaultRegistrationWindowHours: 72,
      defaultRoundDurationHours: 96,
      defaultTournamentDescription: 'Default tournament description',
      defaultRoundDescription: 'Default round description',
    });

    const service = new SystemIntegrationsService(
      prisma as never,
      createAuditLogsServiceMock() as never,
    );
    const emailSettings = await service.getEmailSettings();
    const rules = await service.getNotificationRules();
    const defaults = await service.getTournamentDefaults();

    expect(emailSettings).toMatchObject({
      enabled: true,
      provider: 'resend',
      from: 'no-reply@falconarena.live',
      replyTo: 'team@falconarena.live',
      resendApiKey: 'resend-secret',
      source: 'database',
      isConfigured: true,
    });
    expect(rules).toMatchObject({
      registrationStarted: true,
      roundStarted: false,
      submissionReceived: true,
      deadlineReminder: true,
      submissionClosed: false,
      source: 'database',
    });
    expect(defaults).toMatchObject({
      minTeamMembers: 3,
      maxTeamMembers: 6,
      defaultMinReviewersPerSubmission: 4,
      defaultProjectTimeZone: 'Europe/Warsaw',
      hideTeamsUntilRegistrationClose: false,
      defaultTournamentMaxTeams: 40,
      defaultRegistrationWindowHours: 72,
      defaultRoundDurationHours: 96,
      defaultTournamentDescription: 'Default tournament description',
      defaultRoundDescription: 'Default round description',
      source: 'database',
    });
  });

  it('updates email settings and notification rules in the database', async () => {
    const prisma = createPrismaMock();
    prisma.systemIntegrationSettings.findUnique.mockResolvedValue({
      id: 'default',
      googleSheetsWebhookUrl: null,
      googleSheetsWebhookSecret: null,
      googleSheetsDefaultSheetName: null,
      googleSheetsLastCheckedAt: null,
      googleSheetsLastCheckStatus: null,
      googleSheetsLastCheckMessage: null,
      emailNotificationsEnabled: false,
      emailProvider: 'console',
      emailFrom: '',
      emailReplyTo: '',
      resendApiKey: '',
      emailLastCheckedAt: null,
      emailLastCheckStatus: null,
      emailLastCheckMessage: null,
      notifyRegistrationStarted: true,
      notifyRoundStarted: true,
      notifySubmissionReceived: true,
      notifyDeadlineReminder: true,
      notifySubmissionClosed: true,
    });

    const service = new SystemIntegrationsService(
      prisma as never,
      createAuditLogsServiceMock() as never,
    );

    await service.updateEmailSettings(
      {
        enabled: true,
        provider: 'resend',
        from: 'no-reply@falconarena.live',
        replyTo: 'team@falconarena.live',
        resendApiKey: 'secret',
      },
      { userId: 'admin-1', role: 'ADMIN', email: 'admin@example.com' },
    );

    expect(prisma.systemIntegrationSettings.upsert).toHaveBeenCalledWith({
      where: { id: 'default' },
      update: {
        emailNotificationsEnabled: true,
        emailProvider: 'resend',
        emailFrom: 'no-reply@falconarena.live',
        emailReplyTo: 'team@falconarena.live',
        resendApiKey: 'secret',
        updatedByUserId: 'admin-1',
      },
      create: {
        id: 'default',
        emailNotificationsEnabled: true,
        emailProvider: 'resend',
        emailFrom: 'no-reply@falconarena.live',
        emailReplyTo: 'team@falconarena.live',
        resendApiKey: 'secret',
        updatedByUserId: 'admin-1',
      },
    });

    vi.clearAllMocks();
    prisma.systemIntegrationSettings.findUnique.mockResolvedValue({
      id: 'default',
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
    });

    await service.updateTournamentDefaults(
      {
        minTeamMembers: 2,
        maxTeamMembers: 10,
        defaultMinReviewersPerSubmission: 3,
        defaultProjectTimeZone: 'Europe/Warsaw',
        hideTeamsUntilRegistrationClose: false,
        defaultTournamentMaxTeams: 30,
        defaultRegistrationWindowHours: 24,
        defaultRoundDurationHours: 48,
        defaultTournamentDescription: 'Tournament default',
        defaultRoundDescription: 'Round default',
      },
      { userId: 'admin-1', role: 'ADMIN', email: 'admin@example.com' },
    );

    expect(prisma.systemIntegrationSettings.upsert).toHaveBeenCalledWith({
      where: { id: 'default' },
      update: {
        minTeamMembers: 2,
        maxTeamMembers: 10,
        defaultMinReviewersPerSubmission: 3,
        defaultProjectTimeZone: 'Europe/Warsaw',
        hideTeamsUntilRegistrationClose: false,
        defaultTournamentMaxTeams: 30,
        defaultRegistrationWindowHours: 24,
        defaultRoundDurationHours: 48,
        defaultTournamentDescription: 'Tournament default',
        defaultRoundDescription: 'Round default',
        updatedByUserId: 'admin-1',
      },
      create: {
        id: 'default',
        minTeamMembers: 2,
        maxTeamMembers: 10,
        defaultMinReviewersPerSubmission: 3,
        defaultProjectTimeZone: 'Europe/Warsaw',
        hideTeamsUntilRegistrationClose: false,
        defaultTournamentMaxTeams: 30,
        defaultRegistrationWindowHours: 24,
        defaultRoundDurationHours: 48,
        defaultTournamentDescription: 'Tournament default',
        defaultRoundDescription: 'Round default',
        updatedByUserId: 'admin-1',
      },
    });

    vi.clearAllMocks();
    prisma.systemIntegrationSettings.findUnique.mockResolvedValue({
      id: 'default',
      notifyRegistrationStarted: false,
      notifyRoundStarted: true,
      notifySubmissionReceived: false,
      notifyDeadlineReminder: true,
      notifySubmissionClosed: true,
    });

    await service.updateNotificationRules(
      {
        registrationStarted: false,
        roundStarted: true,
        submissionReceived: false,
        deadlineReminder: true,
        submissionClosed: true,
      },
      { userId: 'admin-1', role: 'ADMIN', email: 'admin@example.com' },
    );

    expect(prisma.systemIntegrationSettings.upsert).toHaveBeenCalledWith({
      where: { id: 'default' },
      update: {
        notifyRegistrationStarted: false,
        notifyRoundStarted: true,
        notifySubmissionReceived: false,
        notifyDeadlineReminder: true,
        notifySubmissionClosed: true,
        updatedByUserId: 'admin-1',
      },
      create: {
        id: 'default',
        notifyRegistrationStarted: false,
        notifyRoundStarted: true,
        notifySubmissionReceived: false,
        notifyDeadlineReminder: true,
        notifySubmissionClosed: true,
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

    const service = new SystemIntegrationsService(
      prisma as never,
      createAuditLogsServiceMock() as never,
    );
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

  it('rejects non-admin actors for mutable system integrations actions', async () => {
    const prisma = createPrismaMock();
    const service = new SystemIntegrationsService(
      prisma as never,
      createAuditLogsServiceMock() as never,
    );

    await expect(
      service.updateNotificationRules(
        {
          registrationStarted: true,
          roundStarted: true,
          submissionReceived: true,
          deadlineReminder: true,
          submissionClosed: true,
        },
        { userId: 'org-1', role: 'ORGANIZER', email: 'org@example.com' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
