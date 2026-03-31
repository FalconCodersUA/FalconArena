import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { CertificateTemplate, TournamentStatus } from '@prisma/client';
import { AuditLogsService } from '../audit-logs.service';
import { AuthUser } from '../common/types/auth-user.type';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertCertificateTemplateDto } from './dto/upsert-certificate-template.dto';

type CertificateKind = 'participation' | 'winner';

type CertificateTemplateView = {
  id: string | null;
  tournamentId: string;
  isDefault: boolean;
  name: string;
  title: string;
  subtitle: string;
  body: string;
  footer: string;
  signerName: string;
  signerRole: string;
  accentColor: string;
};

type CertificateTokenMap = Record<string, string>;

@Injectable()
export class TournamentCertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly leaderboardService?: LeaderboardService,
    @Optional() private readonly auditLogsService?: AuditLogsService,
  ) {}

  async getTemplate(tournamentId: string): Promise<CertificateTemplateView> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        title: true,
      },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    const template = await this.prisma.certificateTemplate.findUnique({
      where: { tournamentId },
    });

    return template
      ? this.mapTemplate(template)
      : this.buildDefaultTemplate(tournament.id);
  }

  async upsertTemplate(
    tournamentId: string,
    dto: UpsertCertificateTemplateDto,
    actor: AuthUser,
  ): Promise<CertificateTemplateView> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    const template = await this.prisma.certificateTemplate.upsert({
      where: { tournamentId },
      update: {
        name: dto.name,
        title: dto.title,
        subtitle: dto.subtitle?.trim() || null,
        body: dto.body,
        footer: dto.footer?.trim() || null,
        signerName: dto.signerName?.trim() || null,
        signerRole: dto.signerRole?.trim() || null,
        accentColor: dto.accentColor ?? '#5E17EB',
      },
      create: {
        tournamentId,
        name: dto.name,
        title: dto.title,
        subtitle: dto.subtitle?.trim() || null,
        body: dto.body,
        footer: dto.footer?.trim() || null,
        signerName: dto.signerName?.trim() || null,
        signerRole: dto.signerRole?.trim() || null,
        accentColor: dto.accentColor ?? '#5E17EB',
      },
    });

    await this.auditLogsService?.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: 'certificate.template_updated',
      entityType: 'certificate_template',
      entityId: template.id,
      entityLabel: template.name,
      tournamentId,
      title: 'Updated certificate template',
      description: `${template.name} was updated for tournament certificates.`,
      metadata: {
        accentColor: template.accentColor,
        hasSigner: !!template.signerName || !!template.signerRole,
      },
    });

    return this.mapTemplate(template);
  }

  async getTeamCertificate(tournamentId: string, teamId: string, kind: CertificateKind) {
    const [tournament, team, template, leaderboard] = await Promise.all([
      this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: {
          id: true,
          title: true,
          status: true,
          startsAt: true,
        },
      }),
      this.prisma.team.findFirst({
        where: {
          id: teamId,
          tournamentId,
        },
        include: {
          captain: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          members: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      this.getTemplate(tournamentId),
      this.leaderboardService?.getTournamentLeaderboard(tournamentId) ?? null,
    ]);

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (tournament.status !== TournamentStatus.FINISHED) {
      throw new BadRequestException(
        'Certificates are available only for finished tournaments',
      );
    }

    const boardRow =
      leaderboard?.rows.find((entry) => entry.teamId === team.id) ?? null;

    if (kind === 'winner' && boardRow?.rank !== 1) {
      throw new BadRequestException(
        'Winner certificate is available only for the first ranked team',
      );
    }

    const issuedAt = new Date();
    const tokens = this.buildTokens({
      teamName: team.name,
      tournamentTitle: tournament.title,
      issuedAt,
      kind,
      rank: boardRow?.rank ?? null,
      totalScore: boardRow?.totalScore ?? null,
    });

    return {
      tournament: {
        id: tournament.id,
        title: tournament.title,
        status: tournament.status,
        startsAt: tournament.startsAt,
      },
      team: {
        id: team.id,
        name: team.name,
        captain: team.captain,
        members: [
          {
            id: team.captain.id,
            fullName: team.captain.fullName,
            email: team.captain.email,
            isCaptain: true,
          },
          ...team.members.map((member) => ({
            id: member.id,
            fullName: member.fullName,
            email: member.email,
            isCaptain: false,
          })),
        ],
      },
      result: {
        rank: boardRow?.rank ?? null,
        totalScore: boardRow?.totalScore ?? null,
        averageScore: boardRow?.averageScore ?? null,
      },
      certificate: {
        kind,
        kindLabel:
          kind === 'winner' ? 'Сертифікат переможця' : 'Сертифікат участі',
        issuedAt: issuedAt.toISOString(),
        template: {
          ...template,
          title: this.resolveTemplateText(template.title, tokens),
          subtitle: this.resolveTemplateText(template.subtitle, tokens),
          body: this.resolveTemplateText(template.body, tokens),
          footer: this.resolveTemplateText(template.footer, tokens),
          signerName: this.resolveTemplateText(template.signerName, tokens),
          signerRole: this.resolveTemplateText(template.signerRole, tokens),
        },
      },
    };
  }

  private buildDefaultTemplate(tournamentId: string): CertificateTemplateView {
    return {
      id: null,
      tournamentId,
      isDefault: true,
      name: 'Основний шаблон',
      title: 'Сертифікат',
      subtitle: 'Підтвердження участі в {{tournamentTitle}}',
      body:
        '{{teamName}} успішно завершила участь у турнірі "{{tournamentTitle}}". {{kindDescription}}',
      footer: 'Дата видачі: {{issuedAt}}',
      signerName: 'Оргкомітет FalconArena',
      signerRole: 'Організатори турніру',
      accentColor: '#5E17EB',
    };
  }

  private mapTemplate(template: CertificateTemplate): CertificateTemplateView {
    return {
      id: template.id,
      tournamentId: template.tournamentId,
      isDefault: false,
      name: template.name,
      title: template.title,
      subtitle: template.subtitle ?? '',
      body: template.body,
      footer: template.footer ?? '',
      signerName: template.signerName ?? '',
      signerRole: template.signerRole ?? '',
      accentColor: template.accentColor,
    };
  }

  private buildTokens(input: {
    teamName: string;
    tournamentTitle: string;
    issuedAt: Date;
    kind: CertificateKind;
    rank: number | null;
    totalScore: number | null;
  }): CertificateTokenMap {
    const issuedAt = input.issuedAt.toISOString().slice(0, 10);
    const isWinner = input.kind === 'winner';
    const rankText = input.rank !== null ? String(input.rank) : '-';
    const totalScoreText =
      input.totalScore !== null ? input.totalScore.toFixed(2) : '-';

    return {
      teamName: input.teamName,
      tournamentTitle: input.tournamentTitle,
      issuedAt,
      rank: rankText,
      totalScore: totalScoreText,
      kindLabel: isWinner ? 'Сертифікат переможця' : 'Сертифікат участі',
      kindDescription: isWinner
        ? `Команда посіла 1 місце та отримала найкращий підсумковий результат у турнірі.`
        : 'Команда представила свій проєкт та виконала вимоги турнірного раунду.',
    };
  }

  private resolveTemplateText(template: string, tokens: CertificateTokenMap) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => tokens[key] ?? '');
  }
}
