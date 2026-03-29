import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TestGoogleSheetsConnectionDto } from './dto/test-google-sheets-connection.dto';
import { UpdateGoogleSheetsSettingsDto } from './dto/update-google-sheets-settings.dto';

type GoogleSheetsConfig = {
  webhookUrl: string;
  secret: string;
  defaultSheetName: string;
  source: 'database' | 'env';
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
      source: settings?.googleSheetsWebhookUrl ? 'database' : this.getEnvFallback() ? 'env' : 'none',
    };
  }

  async updateGoogleSheetsSettings(
    dto: UpdateGoogleSheetsSettingsDto,
    userId: string,
  ) {
    const data = {
      googleSheetsWebhookUrl: this.normalizeOptionalString(dto.webhookUrl),
      googleSheetsWebhookSecret: this.normalizeOptionalString(dto.secret),
      googleSheetsDefaultSheetName: this.normalizeOptionalString(dto.defaultSheetName),
      updatedByUserId: userId,
    };

    await this.prisma.systemIntegrationSettings.upsert({
      where: { id: 'default' },
      update: data,
      create: {
        id: 'default',
        ...data,
      },
    });

    return this.getGoogleSheetsSettings();
  }

  async testGoogleSheetsConnection(
    dto: TestGoogleSheetsConnectionDto,
    user: { userId: string; email: string; role: string },
  ) {
    const config = await this.resolveGoogleSheetsConfig(dto);
    if (!config) {
      return this.persistTestResult({
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
        return this.persistTestResult({
          ok: false,
          status: 'failed',
          message: `Webhook responded with ${response.status}`,
        });
      }

      return this.persistTestResult({
        ok: true,
        status: 'connected',
        message: 'Connection test passed successfully',
      });
    } catch (error) {
      return this.persistTestResult({
        ok: false,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown connection error',
      });
    }
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

    return this.getEnvFallback();
  }

  private async persistTestResult(input: {
    ok: boolean;
    status: string;
    message: string;
  }) {
    const now = new Date();

    await this.prisma.systemIntegrationSettings.upsert({
      where: { id: 'default' },
      update: {
        googleSheetsLastCheckedAt: now,
        googleSheetsLastCheckStatus: input.status,
        googleSheetsLastCheckMessage: input.message,
      },
      create: {
        id: 'default',
        googleSheetsLastCheckedAt: now,
        googleSheetsLastCheckStatus: input.status,
        googleSheetsLastCheckMessage: input.message,
      },
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

  private getEnvFallback(): GoogleSheetsConfig | null {
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

  private normalizeOptionalString(value: string | undefined) {
    const normalized = value?.trim() ?? '';
    return normalized.length > 0 ? normalized : null;
  }
}
