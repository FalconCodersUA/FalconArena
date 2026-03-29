import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TestGoogleSheetsConnectionDto } from './dto/test-google-sheets-connection.dto';
import { UpdateEmailSettingsDto } from './dto/update-email-settings.dto';
import { UpdateGoogleSheetsSettingsDto } from './dto/update-google-sheets-settings.dto';
import { UpdateNotificationRulesDto } from './dto/update-notification-rules.dto';

type GoogleSheetsConfig = {
  webhookUrl: string;
  secret: string;
  defaultSheetName: string;
  source: 'database' | 'env';
};

type EmailConfig = {
  enabled: boolean;
  provider: 'console' | 'resend';
  from: string;
  replyTo: string;
  resendApiKey: string;
  source: 'database' | 'env' | 'default';
};

type NotificationRules = {
  registrationStarted: boolean;
  roundStarted: boolean;
  submissionReceived: boolean;
  deadlineReminder: boolean;
  submissionClosed: boolean;
  source: 'database' | 'default';
};

@Injectable()
export class SystemIntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getGoogleSheetsSettings() {
    const settings = await this.getSettingsRow();

    return {
      webhookUrl: settings?.googleSheetsWebhookUrl ?? '',
      secret: settings?.googleSheetsWebhookSecret ?? '',
      defaultSheetName: settings?.googleSheetsDefaultSheetName ?? '',
      isConfigured: !!settings?.googleSheetsWebhookUrl,
      lastCheckedAt: settings?.googleSheetsLastCheckedAt?.toISOString() ?? null,
      lastCheckStatus: settings?.googleSheetsLastCheckStatus ?? null,
      lastCheckMessage: settings?.googleSheetsLastCheckMessage ?? null,
      source: settings?.googleSheetsWebhookUrl
        ? 'database'
        : this.getEnvGoogleSheetsFallback()
          ? 'env'
          : 'none',
    };
  }

  async updateGoogleSheetsSettings(
    dto: UpdateGoogleSheetsSettingsDto,
    userId: string,
  ) {
    await this.upsertSettings({
      googleSheetsWebhookUrl: this.normalizeOptionalString(dto.webhookUrl),
      googleSheetsWebhookSecret: this.normalizeOptionalString(dto.secret),
      googleSheetsDefaultSheetName: this.normalizeOptionalString(dto.defaultSheetName),
      updatedByUserId: userId,
    });

    return this.getGoogleSheetsSettings();
  }

  async testGoogleSheetsConnection(
    dto: TestGoogleSheetsConnectionDto,
    user: { userId: string; email: string; role: string },
  ) {
    const config = await this.resolveGoogleSheetsConfig(dto);
    if (!config) {
      return this.persistGoogleSheetsTestResult({
        ok: false,
        status: 'not_configured',
        message: 'Google Sheets webhook URL is not configured',
      });
    }

    try {
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.secret
            ? {
                'x-falconarena-export-secret': config.secret,
              }
            : {}),
        },
        body: JSON.stringify({
          event: 'connection_test',
          generatedAt: new Date().toISOString(),
          sheetName: config.defaultSheetName || 'FalconArena Export',
          source: 'falconarena-admin',
          exportedBy: user,
          payload: {
            message: 'Google Sheets integration test from FalconArena',
          },
        }),
      });

      if (!response.ok) {
        return this.persistGoogleSheetsTestResult({
          ok: false,
          status: 'failed',
          message: `Webhook responded with ${response.status}`,
        });
      }

      return this.persistGoogleSheetsTestResult({
        ok: true,
        status: 'connected',
        message: 'Connection test passed successfully',
      });
    } catch (error) {
      return this.persistGoogleSheetsTestResult({
        ok: false,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown connection error',
      });
    }
  }

  async getEmailSettings() {
    const settings = await this.getSettingsRow();
    const fallback = this.getEnvEmailFallback();
    const source = this.hasDatabaseEmailOverride(settings)
      ? 'database'
      : fallback
        ? 'env'
        : 'default';
    const config = await this.getEmailConfig();

    return {
      enabled: config.enabled,
      provider: config.provider,
      from: config.from,
      replyTo: config.replyTo,
      resendApiKey: config.resendApiKey,
      isConfigured:
        config.provider === 'console'
          ? true
          : config.enabled
            ? config.from.length > 0 && config.resendApiKey.length > 0
            : false,
      lastCheckedAt: settings?.emailLastCheckedAt?.toISOString() ?? null,
      lastCheckStatus: settings?.emailLastCheckStatus ?? null,
      lastCheckMessage: settings?.emailLastCheckMessage ?? null,
      source,
    };
  }

  async updateEmailSettings(dto: UpdateEmailSettingsDto, userId: string) {
    await this.upsertSettings({
      emailNotificationsEnabled: dto.enabled ?? null,
      emailProvider: this.normalizeOptionalString(dto.provider),
      emailFrom: this.normalizeOptionalString(dto.from),
      emailReplyTo: this.normalizeOptionalString(dto.replyTo),
      resendApiKey: this.normalizeOptionalString(dto.resendApiKey),
      updatedByUserId: userId,
    });

    return this.getEmailSettings();
  }

  async getNotificationRules() {
    const settings = await this.getSettingsRow();

    return {
      registrationStarted: settings?.notifyRegistrationStarted ?? true,
      roundStarted: settings?.notifyRoundStarted ?? true,
      submissionReceived: settings?.notifySubmissionReceived ?? true,
      deadlineReminder: settings?.notifyDeadlineReminder ?? true,
      submissionClosed: settings?.notifySubmissionClosed ?? true,
      source: this.hasDatabaseNotificationRuleOverride(settings)
        ? ('database' as const)
        : ('default' as const),
    };
  }

  async updateNotificationRules(
    dto: UpdateNotificationRulesDto,
    userId: string,
  ) {
    await this.upsertSettings({
      notifyRegistrationStarted: dto.registrationStarted ?? null,
      notifyRoundStarted: dto.roundStarted ?? null,
      notifySubmissionReceived: dto.submissionReceived ?? null,
      notifyDeadlineReminder: dto.deadlineReminder ?? null,
      notifySubmissionClosed: dto.submissionClosed ?? null,
      updatedByUserId: userId,
    });

    return this.getNotificationRules();
  }

  async getGoogleSheetsConfig() {
    const settings = await this.getSettingsRow();
    if (settings?.googleSheetsWebhookUrl) {
      return {
        webhookUrl: settings.googleSheetsWebhookUrl,
        secret: settings.googleSheetsWebhookSecret ?? '',
        defaultSheetName: settings.googleSheetsDefaultSheetName ?? '',
        source: 'database' as const,
      };
    }

    return this.getEnvGoogleSheetsFallback();
  }

  async getEmailConfig(): Promise<EmailConfig> {
    const settings = await this.getSettingsRow();
    const fallback = this.getEnvEmailFallback();
    const source = this.hasDatabaseEmailOverride(settings)
      ? 'database'
      : fallback
        ? 'env'
        : 'default';

    return {
      enabled: settings?.emailNotificationsEnabled ?? fallback?.enabled ?? false,
      provider:
        (settings?.emailProvider as EmailConfig['provider'] | null) ??
        fallback?.provider ??
        'console',
      from: settings?.emailFrom ?? fallback?.from ?? '',
      replyTo: settings?.emailReplyTo ?? fallback?.replyTo ?? '',
      resendApiKey: settings?.resendApiKey ?? fallback?.resendApiKey ?? '',
      source,
    };
  }

  async getNotificationRulesConfig(): Promise<NotificationRules> {
    return this.getNotificationRules();
  }

  async shouldCreateNotification(type: NotificationType) {
    const rules = await this.getNotificationRulesConfig();

    switch (type) {
      case NotificationType.REGISTRATION_STARTED:
        return rules.registrationStarted;
      case NotificationType.ROUND_STARTED:
        return rules.roundStarted;
      case NotificationType.SUBMISSION_RECEIVED:
        return rules.submissionReceived;
      case NotificationType.DEADLINE_REMINDER:
        return rules.deadlineReminder;
      case NotificationType.SUBMISSION_CLOSED:
        return rules.submissionClosed;
      default:
        return true;
    }
  }

  private async persistGoogleSheetsTestResult(input: {
    ok: boolean;
    status: string;
    message: string;
  }) {
    const now = new Date();

    await this.upsertSettings({
      googleSheetsLastCheckedAt: now,
      googleSheetsLastCheckStatus: input.status,
      googleSheetsLastCheckMessage: input.message,
    });

    return {
      ok: input.ok,
      status: input.status,
      message: input.message,
      checkedAt: now.toISOString(),
    };
  }

  private async resolveGoogleSheetsConfig(
    dto: TestGoogleSheetsConnectionDto,
  ): Promise<GoogleSheetsConfig | null> {
    const webhookUrl = this.normalizeOptionalString(dto.webhookUrl);
    const secret = this.normalizeOptionalString(dto.secret) ?? '';
    const defaultSheetName = this.normalizeOptionalString(dto.defaultSheetName) ?? '';

    if (webhookUrl) {
      return {
        webhookUrl,
        secret,
        defaultSheetName,
        source: 'database',
      };
    }

    return this.getGoogleSheetsConfig();
  }

  private async getSettingsRow() {
    return this.prisma.systemIntegrationSettings.findUnique({
      where: { id: 'default' },
    });
  }

  private async upsertSettings(data: Record<string, unknown>) {
    await this.prisma.systemIntegrationSettings.upsert({
      where: { id: 'default' },
      update: data,
      create: {
        id: 'default',
        ...data,
      },
    });
  }

  private hasDatabaseEmailOverride(
    settings: Awaited<ReturnType<SystemIntegrationsService['getSettingsRow']>>,
  ) {
    return !!(
      settings &&
      (settings.emailNotificationsEnabled !== null ||
        settings.emailProvider !== null ||
        settings.emailFrom !== null ||
        settings.emailReplyTo !== null ||
        settings.resendApiKey !== null)
    );
  }

  private hasDatabaseNotificationRuleOverride(
    settings: Awaited<ReturnType<SystemIntegrationsService['getSettingsRow']>>,
  ) {
    return !!(
      settings &&
      (settings.notifyRegistrationStarted !== null ||
        settings.notifyRoundStarted !== null ||
        settings.notifySubmissionReceived !== null ||
        settings.notifyDeadlineReminder !== null ||
        settings.notifySubmissionClosed !== null)
    );
  }

  private getEnvGoogleSheetsFallback(): GoogleSheetsConfig | null {
    const webhookUrl = this.normalizeOptionalString(process.env.GOOGLE_SHEETS_WEBHOOK_URL);
    if (!webhookUrl) {
      return null;
    }

    return {
      webhookUrl,
      secret: this.normalizeOptionalString(process.env.GOOGLE_SHEETS_WEBHOOK_SECRET) ?? '',
      defaultSheetName:
        this.normalizeOptionalString(process.env.GOOGLE_SHEETS_DEFAULT_SHEET_NAME) ?? '',
      source: 'env',
    };
  }

  private getEnvEmailFallback(): Omit<EmailConfig, 'source'> | null {
    const hasEnv =
      process.env.EMAIL_NOTIFICATIONS_ENABLED !== undefined ||
      process.env.EMAIL_PROVIDER !== undefined ||
      process.env.EMAIL_FROM !== undefined ||
      process.env.EMAIL_REPLY_TO !== undefined ||
      process.env.RESEND_API_KEY !== undefined;

    if (!hasEnv) {
      return null;
    }

    return {
      enabled: process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true',
      provider: this.normalizeEmailProvider(process.env.EMAIL_PROVIDER),
      from: this.normalizeOptionalString(process.env.EMAIL_FROM) ?? '',
      replyTo: this.normalizeOptionalString(process.env.EMAIL_REPLY_TO) ?? '',
      resendApiKey: this.normalizeOptionalString(process.env.RESEND_API_KEY) ?? '',
    };
  }

  private normalizeEmailProvider(value: string | undefined): EmailConfig['provider'] {
    return value?.trim().toLowerCase() === 'resend' ? 'resend' : 'console';
  }

  private normalizeOptionalString(value: string | undefined | null) {
    const normalized = value?.trim() ?? '';
    return normalized.length > 0 ? normalized : null;
  }
}
