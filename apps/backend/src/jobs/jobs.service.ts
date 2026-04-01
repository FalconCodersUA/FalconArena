import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RoundStatus } from '@prisma/client';
import { NotificationEmailService } from '../notification-email.service';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const JOB_TYPE = {
  DEADLINE_REMINDER: 'DEADLINE_REMINDER',
  REGISTRATION_STARTED_NOTIFICATION: 'REGISTRATION_STARTED_NOTIFICATION',
  ROUND_STARTED_NOTIFICATION: 'ROUND_STARTED_NOTIFICATION',
  SUBMISSION_CLOSED_NOTIFICATION: 'SUBMISSION_CLOSED_NOTIFICATION',
  NOTIFICATION_EMAIL_DELIVERY: 'NOTIFICATION_EMAIL_DELIVERY',
} as const;

const JOB_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

type BackgroundJobTypeValue = (typeof JOB_TYPE)[keyof typeof JOB_TYPE];
type BackgroundJobStatusValue = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

type BackgroundJobRecord = {
  id: string;
  type: BackgroundJobTypeValue;
  status: BackgroundJobStatusValue;
  runAt: Date;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  dedupeKey: string;
  payload: unknown;
};

type DeadlineReminderPayload = {
  roundId: string;
  roundTitle: string;
  tournamentId: string;
};

type RegistrationStartedPayload = {
  tournamentId: string;
  tournamentTitle: string;
};

type RoundStartedPayload = {
  roundId: string;
  roundTitle: string;
  tournamentId: string;
};

type SubmissionClosedPayload = {
  roundId: string;
  roundTitle: string;
  tournamentId: string;
};

type NotificationEmailDeliveryPayload = {
  notificationId: string;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const RETRY_DELAY_MS = 60 * 1000;

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private timer: NodeJS.Timeout | null = null;
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationEmailService: NotificationEmailService,
  ) {}

  private get backgroundJobs() {
    return (this.prisma as PrismaService & { backgroundJob: any }).backgroundJob;
  }

  onModuleInit() {
    if (process.env.JOBS_WORKER_ENABLED === 'false') {
      return;
    }

    this.timer = setInterval(() => {
      void this.processDueJobsOnce();
    }, 15000);

    setTimeout(() => {
      void this.processDueJobsOnce();
    }, 1000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async scheduleDeadlineReminderForRound(round: {
    id: string;
    title: string;
    tournamentId: string;
    deadlineAt: Date;
    deadlineReminderSentAt?: Date | null;
  }) {
    if (round.deadlineReminderSentAt) {
      return null;
    }

    const dedupeKey = this.buildDeadlineReminderKey(round.id);
    const existing = await this.backgroundJobs.findUnique({
      where: { dedupeKey },
    });

    if (
      existing &&
      [JOB_STATUS.PENDING, JOB_STATUS.PROCESSING, JOB_STATUS.COMPLETED].includes(
        existing.status,
      )
    ) {
      return existing;
    }

    const runAt = this.calculateDeadlineReminderRunAt(round.deadlineAt);
    const payload: DeadlineReminderPayload = {
      roundId: round.id,
      roundTitle: round.title,
      tournamentId: round.tournamentId,
    };

    if (existing) {
      return this.backgroundJobs.update({
        where: { dedupeKey },
        data: {
          type: JOB_TYPE.DEADLINE_REMINDER,
          status: JOB_STATUS.PENDING,
          runAt,
          lastError: null,
          failedAt: null,
          processingStartedAt: null,
          payload,
        },
      });
    }

    return this.backgroundJobs.create({
      data: {
        type: JOB_TYPE.DEADLINE_REMINDER,
        status: JOB_STATUS.PENDING,
        runAt,
        dedupeKey,
        payload,
      },
    });
  }

  async scheduleRegistrationStartedNotification(input: {
    tournamentId: string;
    tournamentTitle: string;
  }) {
    const dedupeKey = `registration-started:${input.tournamentId}`;
    const payload: RegistrationStartedPayload = {
      tournamentId: input.tournamentId,
      tournamentTitle: input.tournamentTitle,
    };

    return this.createOrRefreshImmediateJob(
      JOB_TYPE.REGISTRATION_STARTED_NOTIFICATION,
      dedupeKey,
      payload,
    );
  }

  async scheduleRoundStartedNotification(input: {
    roundId: string;
    roundTitle: string;
    tournamentId: string;
  }) {
    const dedupeKey = `round-started:${input.roundId}`;
    const payload: RoundStartedPayload = {
      roundId: input.roundId,
      roundTitle: input.roundTitle,
      tournamentId: input.tournamentId,
    };

    return this.createOrRefreshImmediateJob(
      JOB_TYPE.ROUND_STARTED_NOTIFICATION,
      dedupeKey,
      payload,
    );
  }

  async scheduleSubmissionClosedNotification(input: {
    roundId: string;
    roundTitle: string;
    tournamentId: string;
  }) {
    const dedupeKey = `submission-closed:${input.roundId}`;
    const payload: SubmissionClosedPayload = {
      roundId: input.roundId,
      roundTitle: input.roundTitle,
      tournamentId: input.tournamentId,
    };

    return this.createOrRefreshImmediateJob(
      JOB_TYPE.SUBMISSION_CLOSED_NOTIFICATION,
      dedupeKey,
      payload,
    );
  }

  async processDueJobsOnce() {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      const dueJobs = await this.backgroundJobs.findMany({
        where: {
          status: JOB_STATUS.PENDING,
          runAt: {
            lte: new Date(),
          },
        },
        orderBy: { runAt: 'asc' },
        take: 10,
      });

      for (const job of dueJobs) {
        await this.processSingleJob(job);
      }
    } finally {
      this.processing = false;
    }
  }

  private async processSingleJob(job: BackgroundJobRecord) {
    const claimed = await this.backgroundJobs.updateMany({
      where: {
        id: job.id,
        status: JOB_STATUS.PENDING,
      },
      data: {
        status: JOB_STATUS.PROCESSING,
        processingStartedAt: new Date(),
        attempts: {
          increment: 1,
        },
      },
    });

    if (claimed.count === 0) {
      return;
    }

    try {
      if (job.type === JOB_TYPE.DEADLINE_REMINDER) {
        await this.handleDeadlineReminder(job);
      } else if (job.type === JOB_TYPE.REGISTRATION_STARTED_NOTIFICATION) {
        await this.handleRegistrationStartedNotification(job);
      } else if (job.type === JOB_TYPE.ROUND_STARTED_NOTIFICATION) {
        await this.handleRoundStartedNotification(job);
      } else if (job.type === JOB_TYPE.SUBMISSION_CLOSED_NOTIFICATION) {
        await this.handleSubmissionClosedNotification(job);
      } else if (job.type === JOB_TYPE.NOTIFICATION_EMAIL_DELIVERY) {
        await this.handleNotificationEmailDelivery(job);
      }

      await this.backgroundJobs.update({
        where: { id: job.id },
        data: {
          status: JOB_STATUS.COMPLETED,
          completedAt: new Date(),
          processingStartedAt: null,
          lastError: null,
        },
      });
    } catch (error) {
      const refreshed = await this.backgroundJobs.findUnique({
        where: { id: job.id },
        select: { attempts: true, maxAttempts: true },
      });

      const attempts = refreshed?.attempts ?? job.attempts + 1;
      const shouldFail = attempts >= (refreshed?.maxAttempts ?? job.maxAttempts);
      const message = error instanceof Error ? error.message : 'Unknown background job error';

      await this.backgroundJobs.update({
        where: { id: job.id },
        data: shouldFail
          ? {
              status: JOB_STATUS.FAILED,
              failedAt: new Date(),
              processingStartedAt: null,
              lastError: message,
            }
          : {
              status: JOB_STATUS.PENDING,
              runAt: new Date(Date.now() + RETRY_DELAY_MS),
              processingStartedAt: null,
              lastError: message,
            },
      });

      this.logger.warn(
        JSON.stringify({
          event: 'job.failed',
          jobId: job.id,
          type: job.type,
          attempts,
          message,
          failed: shouldFail,
        }),
      );
    }
  }

  private async handleDeadlineReminder(job: BackgroundJobRecord) {
    const payload = job.payload as unknown as DeadlineReminderPayload;
    const round = await this.prisma.round.findUnique({
      where: { id: payload.roundId },
      select: {
        id: true,
        title: true,
        tournamentId: true,
        deadlineAt: true,
        deadlineReminderSentAt: true,
        status: true,
      },
    });

    if (!round) {
      return;
    }

    if (round.deadlineReminderSentAt || round.status !== RoundStatus.ACTIVE) {
      return;
    }

    if (round.deadlineAt.getTime() <= Date.now()) {
      return;
    }

    await this.notificationsService.create({
      type: 'DEADLINE_REMINDER',
      audience: 'ALL',
      title: `Нагадування про дедлайн: ${round.title}`,
      body: 'До завершення прийому робіт залишилося менше 24 годин.',
      linkUrl: `/app/tournaments/${round.tournamentId}`,
    });

    await this.prisma.round.updateMany({
      where: {
        id: round.id,
        deadlineReminderSentAt: null,
      },
      data: {
        deadlineReminderSentAt: new Date(),
      },
    });
  }

  private async handleRegistrationStartedNotification(job: BackgroundJobRecord) {
    const payload = job.payload as RegistrationStartedPayload;

    await this.notificationsService.create({
      type: 'REGISTRATION_STARTED',
      audience: 'ALL',
      title: `Відкрита реєстрація: ${payload.tournamentTitle}`,
      body: 'Реєстрація команди вже доступна в цьому турнірі.',
      linkUrl: `/app/tournaments/${payload.tournamentId}`,
    });
  }

  private async handleRoundStartedNotification(job: BackgroundJobRecord) {
    const payload = job.payload as RoundStartedPayload;

    await this.notificationsService.create({
      type: 'ROUND_STARTED',
      audience: 'ALL',
      title: `Стартував раунд: ${payload.roundTitle}`,
      body: 'Активний раунд відкрито. Перевірте вимоги, дедлайн і подайте роботу вчасно.',
      linkUrl: `/app/tournaments/${payload.tournamentId}`,
    });
  }

  private async handleSubmissionClosedNotification(job: BackgroundJobRecord) {
    const payload = job.payload as SubmissionClosedPayload;

    await this.notificationsService.create({
      type: 'SUBMISSION_CLOSED',
      audience: 'ALL',
      title: `Сабміти закрито: ${payload.roundTitle}`,
      body: 'Прийом робіт для цього раунду завершено.',
      linkUrl: `/app/tournaments/${payload.tournamentId}`,
    });
  }

  private async handleNotificationEmailDelivery(job: BackgroundJobRecord) {
    const payload = job.payload as NotificationEmailDeliveryPayload;
    const notification = await this.prisma.notification.findUnique({
      where: { id: payload.notificationId },
      select: {
        id: true,
        type: true,
        audience: true,
        userId: true,
        title: true,
        body: true,
        linkUrl: true,
      },
    });

    if (!notification) {
      return;
    }

    await this.notificationEmailService.deliver({
      type: notification.type,
      audience: notification.audience,
      userId: notification.userId ?? undefined,
      title: notification.title,
      body: notification.body,
      linkUrl: notification.linkUrl ?? undefined,
    });
  }

  private calculateDeadlineReminderRunAt(deadlineAt: Date) {
    const scheduledAt = new Date(deadlineAt.getTime() - DAY_IN_MS);
    return scheduledAt.getTime() > Date.now() ? scheduledAt : new Date();
  }

  private buildDeadlineReminderKey(roundId: string) {
    return `deadline-reminder:${roundId}`;
  }

  private async createOrRefreshImmediateJob(
    type: BackgroundJobTypeValue,
    dedupeKey: string,
    payload: unknown,
  ) {
    const existing = await this.backgroundJobs.findUnique({
      where: { dedupeKey },
    });

    if (
      existing &&
      [JOB_STATUS.PENDING, JOB_STATUS.PROCESSING, JOB_STATUS.COMPLETED].includes(
        existing.status,
      )
    ) {
      return existing;
    }

    if (existing) {
      return this.backgroundJobs.update({
        where: { dedupeKey },
        data: {
          type,
          status: JOB_STATUS.PENDING,
          runAt: new Date(),
          lastError: null,
          failedAt: null,
          processingStartedAt: null,
          payload,
        },
      });
    }

    return this.backgroundJobs.create({
      data: {
        type,
        status: JOB_STATUS.PENDING,
        runAt: new Date(),
        dedupeKey,
        payload,
      },
    });
  }
}
