import { Injectable, Logger } from '@nestjs/common';
import { NotificationAudience, NotificationType, Role } from '@prisma/client';
import { PrismaService } from './prisma/prisma.service';

type DeliverNotificationEmailInput = {
  type: NotificationType;
  audience: NotificationAudience;
  userId?: string;
  title: string;
  body: string;
  linkUrl?: string;
};

type Recipient = {
  email: string;
  fullName: string;
};

type UserWithSettings = {
  email: string;
  fullName: string;
  settings: {
    notifyAnnouncements: boolean;
    notifyMessages: boolean;
  } | null;
};

@Injectable()
export class NotificationEmailService {
  private readonly logger = new Logger(NotificationEmailService.name);

  constructor(private readonly prisma: PrismaService) {}

  async deliver(input: DeliverNotificationEmailInput) {
    if (!this.isEnabled()) {
      return { status: 'disabled' as const, sent: 0 };
    }

    const recipients = await this.resolveRecipients(input);
    if (recipients.length === 0) {
      return { status: 'skipped' as const, sent: 0 };
    }

    const subject = input.title;
    const actionUrl = this.buildAbsoluteUrl(input.linkUrl);
    const text = this.buildTextBody(input, actionUrl);
    const html = this.buildHtmlBody(input, actionUrl);

    try {
      await this.send({
        to: recipients.map((recipient) => recipient.email),
        subject,
        text,
        html,
      });

      return { status: 'sent' as const, sent: recipients.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to deliver notification email: ${message}`);
      return { status: 'failed' as const, sent: 0 };
    }
  }

  private async resolveRecipients(input: DeliverNotificationEmailInput) {
    const users =
      input.audience === NotificationAudience.USER && input.userId
        ? await this.resolveSingleUser(input.userId)
        : await this.resolveAudienceUsers(input.audience);

    const preferenceKey = this.getPreferenceKey(input.type);
    const uniqueRecipients = new Map<string, Recipient>();

    for (const user of users) {
      if (!this.isPreferenceEnabled(user, preferenceKey)) {
        continue;
      }

      if (!uniqueRecipients.has(user.email)) {
        uniqueRecipients.set(user.email, {
          email: user.email,
          fullName: user.fullName,
        });
      }
    }

    return [...uniqueRecipients.values()];
  }

  private async resolveSingleUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { settings: true },
    });

    return user ? [user] : [];
  }

  private async resolveAudienceUsers(audience: NotificationAudience) {
    if (audience === NotificationAudience.ALL) {
      return this.prisma.user.findMany({
        include: { settings: true },
      });
    }

    if (audience === NotificationAudience.USER) {
      return [];
    }

    return this.prisma.user.findMany({
      where: {
        role: this.toRole(audience),
      },
      include: { settings: true },
    });
  }

  private toRole(audience: Exclude<NotificationAudience, 'ALL' | 'USER'>): Role {
    return audience as unknown as Role;
  }

  private getPreferenceKey(type: NotificationType) {
    switch (type) {
      case NotificationType.SUBMISSION_RECEIVED:
        return 'notifyMessages' as const;
      default:
        return 'notifyAnnouncements' as const;
    }
  }

  private isPreferenceEnabled(
    user: UserWithSettings,
    preferenceKey: 'notifyAnnouncements' | 'notifyMessages',
  ) {
    return user.settings ? user.settings[preferenceKey] : true;
  }

  private isEnabled() {
    return process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';
  }

  private buildAbsoluteUrl(linkUrl?: string) {
    if (!linkUrl) {
      return null;
    }

    if (/^https?:\/\//i.test(linkUrl)) {
      return linkUrl;
    }

    const appDomain = (process.env.APP_DOMAIN ?? 'http://localhost').trim();
    const origin = /^https?:\/\//i.test(appDomain)
      ? appDomain
      : appDomain === 'localhost'
        ? `http://${appDomain}`
        : `https://${appDomain}`;

    return new URL(linkUrl, origin).toString();
  }

  private buildTextBody(
    input: DeliverNotificationEmailInput,
    actionUrl: string | null,
  ) {
    const lines = [input.title, '', input.body];
    if (actionUrl) {
      lines.push('', `Переглянути: ${actionUrl}`);
    }

    return lines.join('\n');
  }

  private buildHtmlBody(
    input: DeliverNotificationEmailInput,
    actionUrl: string | null,
  ) {
    const escapedTitle = this.escapeHtml(input.title);
    const escapedBody = this.escapeHtml(input.body).replace(/\n/g, '<br />');
    const actionMarkup = actionUrl
      ? `<p style="margin:24px 0 0;"><a href="${this.escapeHtml(
          actionUrl,
        )}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#5E17EB;color:#ffffff;text-decoration:none;font-weight:600;">Відкрити у FalconArena</a></p>`
      : '';

    return [
      '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px;background:#f5f4fa;color:#111827;">',
      '<div style="background:#ffffff;border-radius:24px;padding:32px;border:1px solid rgba(15,23,43,0.08);box-shadow:0 16px 40px rgba(15,23,43,0.08);">',
      `<p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#5E17EB;">FalconArena</p>`,
      `<h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;color:#0F172B;">${escapedTitle}</h1>`,
      `<p style="margin:0;font-size:16px;line-height:1.7;color:#334155;">${escapedBody}</p>`,
      actionMarkup,
      '</div>',
      '</div>',
    ].join('');
  }

  private async send(input: {
    to: string[];
    subject: string;
    text: string;
    html: string;
  }) {
    const provider = (process.env.EMAIL_PROVIDER ?? 'console').trim().toLowerCase();
    if (provider === 'console') {
      this.logger.log(
        `EMAIL(console) to=${input.to.join(', ')} subject="${input.subject}"`,
      );
      return;
    }

    if (provider !== 'resend') {
      throw new Error(`Unsupported email provider: ${provider}`);
    }

    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.EMAIL_FROM?.trim();
    const replyTo = process.env.EMAIL_REPLY_TO?.trim();

    if (!apiKey || !from) {
      throw new Error('RESEND_API_KEY and EMAIL_FROM must be configured');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Resend responded with ${response.status}: ${errorBody}`);
    }
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
