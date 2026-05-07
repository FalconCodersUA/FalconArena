import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs.service';
import { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { TestGoogleSheetsConnectionDto } from './dto/test-google-sheets-connection.dto';
import { UpdateEmailSettingsDto } from './dto/update-email-settings.dto';
import { UpdateGoogleSheetsSettingsDto } from './dto/update-google-sheets-settings.dto';
import { UpdateNotificationRulesDto } from './dto/update-notification-rules.dto';
import { UpdatePlatformContentDto } from './dto/update-platform-content.dto';
import { UpdateTournamentDefaultsDto } from './dto/update-tournament-defaults.dto';

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

type LocalizedText = {
  uk: string;
  en: string;
};

type PlatformContent = {
  hero: {
    eyebrow: LocalizedText;
    title: LocalizedText;
    description: LocalizedText;
    bannerImageUrl: string | null;
  };
  product: {
    eyebrow: LocalizedText;
    title: LocalizedText;
    lead: LocalizedText;
  };
  roles: {
    label: LocalizedText;
    organizers: {
      title: LocalizedText;
      lead: LocalizedText;
    };
    teams: {
      title: LocalizedText;
      lead: LocalizedText;
    };
    jury: {
      title: LocalizedText;
      lead: LocalizedText;
    };
  };
  cta: {
    eyebrow: LocalizedText;
    title: LocalizedText;
    lead: LocalizedText;
    registerLabel: LocalizedText;
    workspaceLabel: LocalizedText;
  };
  contacts: {
    eyebrow: LocalizedText;
    title: LocalizedText;
    lead: LocalizedText;
    items: Array<{
      label: LocalizedText;
      value: LocalizedText;
      url: string | null;
    }>;
  };
  source: 'database' | 'default';
};

type UploadedPlatformBannerFile = {
  buffer?: Buffer;
  mimetype?: string;
  size?: number;
};

const LEGACY_CTA_TITLE_UK =
  'Відкрийте турнірний простір і перевірте платформу в реальному сценарії';
const CURRENT_CTA_TITLE_UK =
  'Відкрийте турнірний простір і перевірте себе в реальному сценарії';

export type TournamentDefaultsConfig = {
  minTeamMembers: number;
  maxTeamMembers: number;
  defaultMinReviewersPerSubmission: number;
  defaultProjectTimeZone: string;
  hideTeamsUntilRegistrationClose: boolean;
  defaultTournamentMaxTeams: number | null;
  defaultRegistrationWindowHours: number;
  defaultRoundDurationHours: number;
  defaultTournamentDescription: string;
  defaultRoundDescription: string;
  source: 'database' | 'default';
};

const TOURNAMENT_DEFAULTS_FALLBACK = {
  minTeamMembers: 2,
  maxTeamMembers: 8,
  defaultMinReviewersPerSubmission: 2,
  defaultProjectTimeZone: 'Europe/Kyiv',
  hideTeamsUntilRegistrationClose: true,
  defaultTournamentMaxTeams: null,
  defaultRegistrationWindowHours: 24,
  defaultRoundDurationHours: 24,
  defaultTournamentDescription: '',
  defaultRoundDescription: '',
} satisfies Omit<TournamentDefaultsConfig, 'source'>;

const PLATFORM_CONTENT_FALLBACK = {
  hero: {
    eyebrow: {
      uk: 'Про платформу',
      en: 'About the platform',
    },
    title: {
      uk: 'FalconArena - вебплатформа для командних турнірів з програмування',
      en: 'FalconArena - a web platform for team programming tournaments',
    },
    description: {
      uk: 'FalconArena допомагає організаторам проводити командні турніри з програмування в одному робочому просторі. Платформа обʼєднує реєстрацію команд, керування раундами, подання робіт, оцінювання журі, лідерборд, повідомлення та експорт результатів.',
      en: 'FalconArena helps organizers run team programming tournaments in one workspace. The platform combines team registration, round management, submissions, jury evaluation, leaderboard, messages, and result export.',
    },
    bannerImageUrl: null,
  },
  product: {
    eyebrow: {
      uk: 'Робочий процес',
      en: 'Workflow',
    },
    title: {
      uk: 'Один маршрут для турніру від реєстрації до фінального лідерборда',
      en: 'One tournament route from registration to the final leaderboard',
    },
    lead: {
      uk: 'Адміністратор задає правила, команди працюють із завданнями, журі оцінює сабміти, а результати збираються в архіві без ручних таблиць.',
      en: 'Admins define rules, teams work with tasks, jury members review submissions, and results move into the archive without manual spreadsheets.',
    },
  },
  roles: {
    label: {
      uk: 'Ролі платформи',
      en: 'Platform roles',
    },
    organizers: {
      title: {
        uk: 'Організатори',
        en: 'Organizers',
      },
      lead: {
        uk: 'Створюють турніри, керують раундами, командами, сповіщеннями та експортом результатів.',
        en: 'Create tournaments, manage rounds, teams, notifications, and result export.',
      },
    },
    teams: {
      title: {
        uk: 'Команди',
        en: 'Teams',
      },
      lead: {
        uk: 'Бачать актуальні завдання, дедлайни, статус реєстрації та подають посилання на GitHub і демо.',
        en: 'See current tasks, deadlines, registration status, and submit GitHub and demo links.',
      },
    },
    jury: {
      title: {
        uk: 'Журі',
        en: 'Jury',
      },
      lead: {
        uk: 'Отримує призначені роботи, виставляє оцінки за критеріями та формує прозорий результат.',
        en: 'Receive assigned work, score by criteria, and build a transparent final result.',
      },
    },
  },
  cta: {
    eyebrow: {
      uk: 'Почати роботу',
      en: 'Start working',
    },
    title: {
      uk: 'Відкрийте турнірний простір і перевірте себе в реальному сценарії',
      en: 'Open the tournament workspace and test the platform in a real scenario',
    },
    lead: {
      uk: 'Найкраще FalconArena видно в дії: турніри, команди, сабміти, оцінювання та результати працюють як єдиний продукт.',
      en: 'FalconArena is clearest in action: tournaments, teams, submissions, evaluation, and results operate as one product.',
    },
    registerLabel: {
      uk: 'Створити акаунт команди',
      en: 'Create team account',
    },
    workspaceLabel: {
      uk: 'Перейти до турнірів',
      en: 'Go to tournaments',
    },
  },
  contacts: {
    eyebrow: {
      uk: 'Наші контакти',
      en: 'Our contacts',
    },
    title: {
      uk: 'Звʼяжіться з командою FalconArena',
      en: 'Contact the FalconArena team',
    },
    lead: {
      uk: 'Виберіть зручний канал, щоб поставити питання про платформу, турнір або співпрацю.',
      en: 'Choose a convenient channel for questions about the platform, tournaments, or collaboration.',
    },
    items: [
      {
        label: {
          uk: 'Email',
          en: 'Email',
        },
        value: {
          uk: 'team@falconarena.live',
          en: 'team@falconarena.live',
        },
        url: 'mailto:team@falconarena.live',
      },
      {
        label: {
          uk: 'Telegram',
          en: 'Telegram',
        },
        value: {
          uk: '@falconarena',
          en: '@falconarena',
        },
        url: 'https://t.me/falconarena',
      },
      {
        label: {
          uk: 'GitHub',
          en: 'GitHub',
        },
        value: {
          uk: 'github.com/falconarena',
          en: 'github.com/falconarena',
        },
        url: 'https://github.com/falconarena',
      },
      {
        label: {
          uk: 'LinkedIn',
          en: 'LinkedIn',
        },
        value: {
          uk: 'FalconArena',
          en: 'FalconArena',
        },
        url: 'https://www.linkedin.com',
      },
    ],
  },
} satisfies Omit<PlatformContent, 'source'>;

@Injectable()
export class SystemIntegrationsService {
  private static readonly platformBannerMimeExtensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  private static readonly maxPlatformBannerBytes = 5 * 1024 * 1024;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly storageService: StorageService,
  ) {}

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
      lastExportAt: settings?.googleSheetsLastExportAt?.toISOString() ?? null,
      lastExportStatus: settings?.googleSheetsLastExportStatus ?? null,
      lastExportMessage: settings?.googleSheetsLastExportMessage ?? null,
      lastExportUrl: settings?.googleSheetsLastExportUrl ?? null,
      source: settings?.googleSheetsWebhookUrl
        ? 'database'
        : this.getEnvGoogleSheetsFallback()
          ? 'env'
          : 'none',
    };
  }

  async updateGoogleSheetsSettings(
    dto: UpdateGoogleSheetsSettingsDto,
    actor: AuthUser,
  ) {
    this.assertAdminActor(actor);

    await this.upsertSettings({
      googleSheetsWebhookUrl: this.normalizeOptionalString(dto.webhookUrl),
      googleSheetsWebhookSecret: this.normalizeOptionalString(dto.secret),
      googleSheetsDefaultSheetName: this.normalizeOptionalString(dto.defaultSheetName),
      updatedByUserId: actor.userId,
    });

    await this.auditLogsService.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: 'integration.google_sheets_updated',
      entityType: 'system_integration',
      entityId: 'google-sheets',
      entityLabel: 'Google Sheets',
      title: 'Updated Google Sheets settings',
      description: 'Google Sheets webhook settings were changed.',
      metadata: {
        hasWebhookUrl: !!dto.webhookUrl,
        hasSecret: !!dto.secret,
        defaultSheetName: dto.defaultSheetName ?? null,
      },
    });

    return this.getGoogleSheetsSettings();
  }

  async testGoogleSheetsConnection(
    dto: TestGoogleSheetsConnectionDto,
    user: { userId: string; email: string; role: string },
  ) {
    this.assertAdminActor(user);

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

  async persistEmailDeliveryResult(input: {
    ok: boolean;
    status: string;
    message: string;
  }) {
    const now = new Date();

    await this.upsertSettings({
      emailLastCheckedAt: now,
      emailLastCheckStatus: input.status,
      emailLastCheckMessage: input.message,
    });

    return {
      ok: input.ok,
      status: input.status,
      message: input.message,
      checkedAt: now.toISOString(),
    };
  }

  async persistGoogleSheetsExportResult(input: {
    ok: boolean;
    status: string;
    message: string;
    url?: string | null;
  }) {
    const now = new Date();

    await this.upsertSettings({
      googleSheetsLastExportAt: now,
      googleSheetsLastExportStatus: input.status,
      googleSheetsLastExportMessage: input.message,
      googleSheetsLastExportUrl: input.url ?? null,
    });

    return {
      ok: input.ok,
      status: input.status,
      message: input.message,
      url: input.url ?? null,
      exportedAt: now.toISOString(),
    };
  }

  async updateEmailSettings(dto: UpdateEmailSettingsDto, actor: AuthUser) {
    this.assertAdminActor(actor);

    await this.upsertSettings({
      emailNotificationsEnabled: dto.enabled ?? null,
      emailProvider: this.normalizeOptionalString(dto.provider),
      emailFrom: this.normalizeOptionalString(dto.from),
      emailReplyTo: this.normalizeOptionalString(dto.replyTo),
      resendApiKey: this.normalizeOptionalString(dto.resendApiKey),
      updatedByUserId: actor.userId,
    });

    await this.auditLogsService.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: 'integration.email_updated',
      entityType: 'system_integration',
      entityId: 'email',
      entityLabel: 'Email delivery',
      title: 'Updated email delivery settings',
      description: 'Email provider settings were changed.',
      metadata: {
        enabled: dto.enabled ?? null,
        provider: dto.provider ?? null,
        from: dto.from ?? null,
      },
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
    actor: AuthUser,
  ) {
    this.assertAdminActor(actor);

    await this.upsertSettings({
      notifyRegistrationStarted: dto.registrationStarted ?? null,
      notifyRoundStarted: dto.roundStarted ?? null,
      notifySubmissionReceived: dto.submissionReceived ?? null,
      notifyDeadlineReminder: dto.deadlineReminder ?? null,
      notifySubmissionClosed: dto.submissionClosed ?? null,
      updatedByUserId: actor.userId,
    });

    await this.auditLogsService.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: 'integration.notification_rules_updated',
      entityType: 'system_integration',
      entityId: 'notification-rules',
      entityLabel: 'Notification rules',
      title: 'Updated notification rules',
      description: 'Global notification rules were changed.',
      metadata: dto as Record<string, boolean | undefined>,
    });

    return this.getNotificationRules();
  }

  async getTournamentDefaults() {
    const settings = await this.getSettingsRow();
    const config = this.toTournamentDefaults(settings);

    return {
      ...config,
      source: this.hasDatabaseTournamentDefaultOverride(settings)
        ? ('database' as const)
        : ('default' as const),
    };
  }

  async getPublicTournamentDefaults() {
    const config = await this.getTournamentDefaultsConfig();

    return {
      minTeamMembers: config.minTeamMembers,
      maxTeamMembers: config.maxTeamMembers,
      defaultMinReviewersPerSubmission: config.defaultMinReviewersPerSubmission,
      defaultProjectTimeZone: config.defaultProjectTimeZone,
      hideTeamsUntilRegistrationClose: config.hideTeamsUntilRegistrationClose,
      defaultTournamentMaxTeams: config.defaultTournamentMaxTeams,
      defaultRegistrationWindowHours: config.defaultRegistrationWindowHours,
      defaultRoundDurationHours: config.defaultRoundDurationHours,
      defaultTournamentDescription: config.defaultTournamentDescription,
      defaultRoundDescription: config.defaultRoundDescription,
    };
  }

  async updateTournamentDefaults(
    dto: UpdateTournamentDefaultsDto,
    actor: AuthUser,
  ) {
    this.assertAdminActor(actor);

    const nextMin = dto.minTeamMembers ?? null;
    const nextMax = dto.maxTeamMembers ?? null;

    if (nextMin && nextMax && nextMin > nextMax) {
      throw new BadRequestException(
        'minTeamMembers cannot be greater than maxTeamMembers',
      );
    }

    await this.upsertSettings({
      minTeamMembers: nextMin,
      maxTeamMembers: nextMax,
      defaultMinReviewersPerSubmission:
        dto.defaultMinReviewersPerSubmission ?? null,
      defaultProjectTimeZone: this.normalizeOptionalString(dto.defaultProjectTimeZone),
      hideTeamsUntilRegistrationClose: dto.hideTeamsUntilRegistrationClose ?? null,
      defaultTournamentMaxTeams: dto.defaultTournamentMaxTeams ?? null,
      defaultRegistrationWindowHours: dto.defaultRegistrationWindowHours ?? null,
      defaultRoundDurationHours: dto.defaultRoundDurationHours ?? null,
      defaultTournamentDescription: this.normalizeOptionalString(
        dto.defaultTournamentDescription,
      ),
      defaultRoundDescription: this.normalizeOptionalString(
        dto.defaultRoundDescription,
      ),
      updatedByUserId: actor.userId,
    });

    await this.auditLogsService.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: 'integration.tournament_defaults_updated',
      entityType: 'system_integration',
      entityId: 'tournament-defaults',
      entityLabel: 'Tournament defaults',
      title: 'Updated tournament defaults',
      description: 'Project-wide tournament defaults were changed.',
      metadata: {
        minTeamMembers: dto.minTeamMembers ?? null,
        maxTeamMembers: dto.maxTeamMembers ?? null,
        defaultMinReviewersPerSubmission:
          dto.defaultMinReviewersPerSubmission ?? null,
        defaultProjectTimeZone: dto.defaultProjectTimeZone ?? null,
        hideTeamsUntilRegistrationClose:
          dto.hideTeamsUntilRegistrationClose ?? null,
      },
    });

    return this.getTournamentDefaults();
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

  async getPlatformContent(): Promise<PlatformContent> {
    const settings = await this.getSettingsRow();
    const hasOverride = this.hasDatabasePlatformContentOverride(settings);
    const content = this.resolvePlatformContent(settings);

    return {
      ...content,
      source: hasOverride ? 'database' : 'default',
    };
  }

  async updatePlatformContent(
    dto: UpdatePlatformContentDto,
    actor: AuthUser,
  ) {
    this.assertAdminActor(actor);
    const settings = await this.getSettingsRow();
    const previousContent = this.resolvePlatformContent(settings);
    const content = this.normalizePlatformContentInput(dto);

    await this.upsertSettings({
      aboutPageContent: content as unknown as Prisma.InputJsonValue,
      aboutPageTitle: content.hero.title.uk,
      aboutPageDescription: content.hero.description.uk,
      updatedByUserId: actor.userId,
    });

    await this.auditLogsService.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: 'integration.platform_content_updated',
      entityType: 'system_integration',
      entityId: 'platform-content',
      entityLabel: 'Platform content',
      title: 'Updated platform content',
      description: 'Public platform content was changed.',
      metadata: {
        hasHeroTitle: !!content.hero.title.uk || !!content.hero.title.en,
        hasHeroDescription: !!content.hero.description.uk || !!content.hero.description.en,
      },
    });

    if (previousContent.hero.bannerImageUrl !== content.hero.bannerImageUrl) {
      await this.storageService.removeManagedObject(previousContent.hero.bannerImageUrl);
    }

    return this.getPlatformContent();
  }

  async uploadPlatformContentBanner(
    file: UploadedPlatformBannerFile | undefined,
    actor: AuthUser,
  ) {
    this.assertAdminActor(actor);

    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Platform banner file is required');
    }

    const mimeType = file.mimetype?.toLowerCase() ?? '';
    const extension = SystemIntegrationsService.platformBannerMimeExtensions[mimeType];
    if (!extension) {
      throw new BadRequestException('Platform banner image type is not supported');
    }

    if ((file.size ?? file.buffer.length) > SystemIntegrationsService.maxPlatformBannerBytes) {
      throw new BadRequestException('Platform banner image is too large');
    }

    try {
      const storedBanner = await this.storageService.storePlatformBanner({
        extension,
        mimeType,
        body: file.buffer,
      });

      return {
        url: storedBanner.publicUrl,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown platform banner storage error';
      throw new InternalServerErrorException(message);
    }
  }

  async getTournamentDefaultsConfig(): Promise<TournamentDefaultsConfig> {
    return this.getTournamentDefaults();
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

  private hasDatabaseTournamentDefaultOverride(
    settings: Awaited<ReturnType<SystemIntegrationsService['getSettingsRow']>>,
  ) {
    return !!(
      settings &&
      (settings.minTeamMembers !== null ||
        settings.maxTeamMembers !== null ||
        settings.defaultMinReviewersPerSubmission !== null ||
        settings.defaultProjectTimeZone !== null ||
        settings.hideTeamsUntilRegistrationClose !== null ||
        settings.defaultTournamentMaxTeams !== null ||
        settings.defaultRegistrationWindowHours !== null ||
        settings.defaultRoundDurationHours !== null ||
        settings.defaultTournamentDescription !== null ||
        settings.defaultRoundDescription !== null)
    );
  }

  private hasDatabasePlatformContentOverride(
    settings: Awaited<ReturnType<SystemIntegrationsService['getSettingsRow']>>,
  ) {
    return !!(
      settings &&
      (settings.aboutPageContent != null ||
        settings.aboutPageTitle != null ||
        settings.aboutPageDescription != null)
    );
  }

  private resolvePlatformContent(
    settings: Awaited<ReturnType<SystemIntegrationsService['getSettingsRow']>>,
  ): Omit<PlatformContent, 'source'> {
    const content = this.normalizePlatformContentInput(
      this.isPlainRecord(settings?.aboutPageContent)
        ? settings.aboutPageContent
        : {},
    );

    if (settings?.aboutPageTitle) {
      content.hero.title.uk = settings.aboutPageTitle;
    }

    if (settings?.aboutPageDescription) {
      content.hero.description.uk = settings.aboutPageDescription;
    }

    return content;
  }

  private normalizePlatformContentInput(
    value: UpdatePlatformContentDto | Record<string, unknown>,
  ): Omit<PlatformContent, 'source'> {
    const source = this.isPlainRecord(value) ? value : {};
    const content: Omit<PlatformContent, 'source'> = structuredClone(
      PLATFORM_CONTENT_FALLBACK,
    );

    content.hero.eyebrow = this.normalizeLocalizedText(
      this.readPath(source, 'hero', 'eyebrow'),
      PLATFORM_CONTENT_FALLBACK.hero.eyebrow,
      160,
    );
    content.hero.title = this.normalizeLocalizedText(
      this.readPath(source, 'hero', 'title'),
      PLATFORM_CONTENT_FALLBACK.hero.title,
      160,
    );
    content.hero.description = this.normalizeLocalizedText(
      this.readPath(source, 'hero', 'description'),
      PLATFORM_CONTENT_FALLBACK.hero.description,
      5000,
    );
    content.hero.bannerImageUrl = this.normalizeOptionalImageUrl(
      this.readPath(source, 'hero', 'bannerImageUrl'),
    );
    content.product.eyebrow = this.normalizeLocalizedText(
      this.readPath(source, 'product', 'eyebrow'),
      PLATFORM_CONTENT_FALLBACK.product.eyebrow,
      160,
    );
    content.product.title = this.normalizeLocalizedText(
      this.readPath(source, 'product', 'title'),
      PLATFORM_CONTENT_FALLBACK.product.title,
      160,
    );
    content.product.lead = this.normalizeLocalizedText(
      this.readPath(source, 'product', 'lead'),
      PLATFORM_CONTENT_FALLBACK.product.lead,
      5000,
    );
    content.roles.label = this.normalizeLocalizedText(
      this.readPath(source, 'roles', 'label'),
      PLATFORM_CONTENT_FALLBACK.roles.label,
      160,
    );
    content.roles.organizers.title = this.normalizeLocalizedText(
      this.readPath(source, 'roles', 'organizers', 'title'),
      PLATFORM_CONTENT_FALLBACK.roles.organizers.title,
      160,
    );
    content.roles.organizers.lead = this.normalizeLocalizedText(
      this.readPath(source, 'roles', 'organizers', 'lead'),
      PLATFORM_CONTENT_FALLBACK.roles.organizers.lead,
      5000,
    );
    content.roles.teams.title = this.normalizeLocalizedText(
      this.readPath(source, 'roles', 'teams', 'title'),
      PLATFORM_CONTENT_FALLBACK.roles.teams.title,
      160,
    );
    content.roles.teams.lead = this.normalizeLocalizedText(
      this.readPath(source, 'roles', 'teams', 'lead'),
      PLATFORM_CONTENT_FALLBACK.roles.teams.lead,
      5000,
    );
    content.roles.jury.title = this.normalizeLocalizedText(
      this.readPath(source, 'roles', 'jury', 'title'),
      PLATFORM_CONTENT_FALLBACK.roles.jury.title,
      160,
    );
    content.roles.jury.lead = this.normalizeLocalizedText(
      this.readPath(source, 'roles', 'jury', 'lead'),
      PLATFORM_CONTENT_FALLBACK.roles.jury.lead,
      5000,
    );
    content.cta.eyebrow = this.normalizeLocalizedText(
      this.readPath(source, 'cta', 'eyebrow'),
      PLATFORM_CONTENT_FALLBACK.cta.eyebrow,
      160,
    );
    content.cta.title = this.normalizeLocalizedText(
      this.readPath(source, 'cta', 'title'),
      PLATFORM_CONTENT_FALLBACK.cta.title,
      160,
    );
    content.cta.lead = this.normalizeLocalizedText(
      this.readPath(source, 'cta', 'lead'),
      PLATFORM_CONTENT_FALLBACK.cta.lead,
      5000,
    );
    content.cta.registerLabel = this.normalizeLocalizedText(
      this.readPath(source, 'cta', 'registerLabel'),
      PLATFORM_CONTENT_FALLBACK.cta.registerLabel,
      160,
    );
    content.cta.workspaceLabel = this.normalizeLocalizedText(
      this.readPath(source, 'cta', 'workspaceLabel'),
      PLATFORM_CONTENT_FALLBACK.cta.workspaceLabel,
      160,
    );
    content.contacts.eyebrow = this.normalizeLocalizedText(
      this.readPath(source, 'contacts', 'eyebrow'),
      PLATFORM_CONTENT_FALLBACK.contacts.eyebrow,
      160,
    );
    content.contacts.title = this.normalizeLocalizedText(
      this.readPath(source, 'contacts', 'title'),
      PLATFORM_CONTENT_FALLBACK.contacts.title,
      160,
    );
    content.contacts.lead = this.normalizeLocalizedText(
      this.readPath(source, 'contacts', 'lead'),
      PLATFORM_CONTENT_FALLBACK.contacts.lead,
      5000,
    );
    content.contacts.items = this.normalizeContactItems(
      this.readPath(source, 'contacts', 'items'),
      PLATFORM_CONTENT_FALLBACK.contacts.items,
    );

    const legacyTitle = this.normalizeOptionalString(
      'aboutPageTitle' in source ? String(source.aboutPageTitle ?? '') : undefined,
    );
    const legacyDescription = this.normalizeOptionalString(
      'aboutPageDescription' in source
        ? String(source.aboutPageDescription ?? '')
        : undefined,
    );

    if (legacyTitle) {
      content.hero.title.uk = legacyTitle;
    }

    if (legacyDescription) {
      content.hero.description.uk = legacyDescription;
    }

    return content;
  }

  private normalizeContactItems(
    value: unknown,
    fallback: Omit<PlatformContent, 'source'>['contacts']['items'],
  ) {
    const source = Array.isArray(value) ? value : [];

    return fallback.map((fallbackItem, index) => {
      const item = this.isPlainRecord(source[index]) ? source[index] : {};

      return {
        label: this.normalizeLocalizedText(item.label, fallbackItem.label, 80),
        value: this.normalizeLocalizedText(item.value, fallbackItem.value, 180),
        url:
          typeof item.url === 'string'
            ? this.normalizeOptionalLinkUrl(item.url)
            : fallbackItem.url,
      };
    });
  }

  private normalizeLocalizedText(
    value: unknown,
    fallback: LocalizedText,
    maxLength: number,
  ): LocalizedText {
    const source = this.isPlainRecord(value) ? value : {};

    return {
      uk: this.normalizeRequiredContentString(source.uk, fallback.uk, maxLength),
      en: this.normalizeRequiredContentString(source.en, fallback.en, maxLength),
    };
  }

  private normalizeRequiredContentString(
    value: unknown,
    fallback: string,
    maxLength: number,
  ) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    const result = normalized.length > 0 ? normalized : fallback;
    const migratedResult = result === LEGACY_CTA_TITLE_UK ? CURRENT_CTA_TITLE_UK : result;

    if (migratedResult.length > maxLength) {
      throw new BadRequestException(`Platform content field exceeds ${maxLength} characters`);
    }

    return migratedResult;
  }

  private normalizeOptionalImageUrl(value: unknown) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized) {
      return null;
    }

    if (normalized.length > 2000) {
      throw new BadRequestException('Platform content image URL exceeds 2000 characters');
    }

    if (normalized.startsWith('/')) {
      return normalized;
    }

    try {
      const url = new URL(normalized);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return normalized;
      }
    } catch {
      throw new BadRequestException(
        'Platform content image URL must be an HTTP(S) URL or an absolute path',
      );
    }

    throw new BadRequestException(
      'Platform content image URL must be an HTTP(S) URL or an absolute path',
    );
  }

  private normalizeOptionalLinkUrl(value: unknown) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized) {
      return null;
    }

    if (normalized.length > 2000) {
      throw new BadRequestException('Platform content contact URL exceeds 2000 characters');
    }

    if (normalized.startsWith('/')) {
      return normalized;
    }

    try {
      const url = new URL(normalized);
      if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:') {
        return normalized;
      }
    } catch {
      throw new BadRequestException(
        'Platform content contact URL must be an HTTP(S), mailto, or absolute path URL',
      );
    }

    throw new BadRequestException(
      'Platform content contact URL must be an HTTP(S), mailto, or absolute path URL',
    );
  }

  private readPath(source: Record<string, unknown>, ...path: string[]) {
    let current: unknown = source;

    for (const key of path) {
      if (!this.isPlainRecord(current)) {
        return undefined;
      }

      current = current[key];
    }

    return current;
  }

  private isPlainRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private toTournamentDefaults(
    settings: Awaited<ReturnType<SystemIntegrationsService['getSettingsRow']>>,
  ): TournamentDefaultsConfig {
    const sanitizedMinTeamMembers =
      settings?.minTeamMembers && settings.minTeamMembers > 0
        ? settings.minTeamMembers
        : TOURNAMENT_DEFAULTS_FALLBACK.minTeamMembers;
    const sanitizedMaxTeamMembers =
      settings?.maxTeamMembers && settings.maxTeamMembers > 0
        ? settings.maxTeamMembers
        : TOURNAMENT_DEFAULTS_FALLBACK.maxTeamMembers;

    return {
      minTeamMembers: sanitizedMinTeamMembers,
      maxTeamMembers:
        Number.isInteger(sanitizedMaxTeamMembers) && sanitizedMaxTeamMembers > 0
          ? Math.max(sanitizedMaxTeamMembers, sanitizedMinTeamMembers)
          : TOURNAMENT_DEFAULTS_FALLBACK.maxTeamMembers,
      defaultMinReviewersPerSubmission:
        settings?.defaultMinReviewersPerSubmission ??
        TOURNAMENT_DEFAULTS_FALLBACK.defaultMinReviewersPerSubmission,
      defaultProjectTimeZone:
        settings?.defaultProjectTimeZone ??
        TOURNAMENT_DEFAULTS_FALLBACK.defaultProjectTimeZone,
      hideTeamsUntilRegistrationClose:
        settings?.hideTeamsUntilRegistrationClose ??
        TOURNAMENT_DEFAULTS_FALLBACK.hideTeamsUntilRegistrationClose,
      defaultTournamentMaxTeams:
        settings?.defaultTournamentMaxTeams ??
        TOURNAMENT_DEFAULTS_FALLBACK.defaultTournamentMaxTeams,
      defaultRegistrationWindowHours:
        settings?.defaultRegistrationWindowHours ??
        TOURNAMENT_DEFAULTS_FALLBACK.defaultRegistrationWindowHours,
      defaultRoundDurationHours:
        settings?.defaultRoundDurationHours ??
        TOURNAMENT_DEFAULTS_FALLBACK.defaultRoundDurationHours,
      defaultTournamentDescription:
        settings?.defaultTournamentDescription ??
        TOURNAMENT_DEFAULTS_FALLBACK.defaultTournamentDescription,
      defaultRoundDescription:
        settings?.defaultRoundDescription ??
        TOURNAMENT_DEFAULTS_FALLBACK.defaultRoundDescription,
      source: this.hasDatabaseTournamentDefaultOverride(settings)
        ? 'database'
        : 'default',
    };
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

  private assertAdminActor(actor: { role: string }) {
    if (actor.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can manage system integrations');
    }
  }

  private normalizeOptionalString(value: string | undefined | null) {
    const normalized = value?.trim() ?? '';
    return normalized.length > 0 ? normalized : null;
  }
}
