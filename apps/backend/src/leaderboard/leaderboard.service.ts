import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SystemIntegrationsService } from '../system-integrations/system-integrations.service';

type ScoresPayload = {
  technicalBackend?: number;
  technicalDatabase?: number;
  technicalFrontend?: number;
  mustHave?: number;
  stability?: number;
  usability?: number;
};

type GoogleSheetsExportOptions = {
  sheetName?: string;
  exportedBy?: {
    userId: string;
    email: string;
    role: string;
  };
};

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemIntegrationsService: SystemIntegrationsService,
  ) {}

  async getTournamentLeaderboard(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        title: true,
        status: true,
      },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    const teams = await this.prisma.team.findMany({
      where: { tournamentId },
      select: {
        id: true,
        name: true,
        organization: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const evaluations = await this.prisma.evaluation.findMany({
      where: {
        assignment: {
          round: {
            tournamentId,
          },
        },
      },
      select: {
        totalScore: true,
        scores: true,
        assignment: {
          select: {
            roundId: true,
            round: {
              select: {
                title: true,
              },
            },
            submission: {
              select: {
                teamId: true,
              },
            },
          },
        },
      },
    });

    const teamMap = new Map<
      string,
      {
        teamId: string;
        teamName: string;
        organization: string | null;
        totalEvaluationScoreSum: number;
        totalEvaluations: number;
        categorySums: Required<ScoresPayload>;
        rounds: Map<
          string,
          {
            roundId: string;
            roundTitle: string;
            scoreSum: number;
            evaluationsCount: number;
          }
        >;
      }
    >();

    for (const team of teams) {
      teamMap.set(team.id, {
        teamId: team.id,
        teamName: team.name,
        organization: team.organization,
        totalEvaluationScoreSum: 0,
        totalEvaluations: 0,
        categorySums: {
          technicalBackend: 0,
          technicalDatabase: 0,
          technicalFrontend: 0,
          mustHave: 0,
          stability: 0,
          usability: 0,
        },
        rounds: new Map(),
      });
    }

    for (const evaluation of evaluations) {
      const teamId = evaluation.assignment.submission.teamId;
      const roundId = evaluation.assignment.roundId;
      const roundTitle = evaluation.assignment.round.title;
      const entry = teamMap.get(teamId);

      if (!entry) {
        continue;
      }

      entry.totalEvaluations += 1;
      entry.totalEvaluationScoreSum += evaluation.totalScore;

      const roundEntry = entry.rounds.get(roundId) ?? {
        roundId,
        roundTitle,
        scoreSum: 0,
        evaluationsCount: 0,
      };

      roundEntry.scoreSum += evaluation.totalScore;
      roundEntry.evaluationsCount += 1;
      entry.rounds.set(roundId, roundEntry);

      const scores = (evaluation.scores ?? {}) as ScoresPayload;
      entry.categorySums.technicalBackend += scores.technicalBackend ?? 0;
      entry.categorySums.technicalDatabase += scores.technicalDatabase ?? 0;
      entry.categorySums.technicalFrontend += scores.technicalFrontend ?? 0;
      entry.categorySums.mustHave += scores.mustHave ?? 0;
      entry.categorySums.stability += scores.stability ?? 0;
      entry.categorySums.usability += scores.usability ?? 0;
    }

    const rows = [...teamMap.values()].map((entry) => {
      const roundRows = [...entry.rounds.values()].map((round) => ({
        roundId: round.roundId,
        roundTitle: round.roundTitle,
        evaluationsCount: round.evaluationsCount,
        averageScore: this.round2(round.scoreSum / round.evaluationsCount),
      }));

      const totalScore = this.round2(
        roundRows.reduce((acc, round) => acc + round.averageScore, 0),
      );
      const averageScore =
        entry.totalEvaluations > 0
          ? this.round2(entry.totalEvaluationScoreSum / entry.totalEvaluations)
          : 0;

      return {
        teamId: entry.teamId,
        teamName: entry.teamName,
        organization: entry.organization,
        totalScore,
        averageScore,
        evaluationsCount: entry.totalEvaluations,
        categoryAverages:
          entry.totalEvaluations > 0
            ? {
                technicalBackend: this.round2(
                  entry.categorySums.technicalBackend / entry.totalEvaluations,
                ),
                technicalDatabase: this.round2(
                  entry.categorySums.technicalDatabase / entry.totalEvaluations,
                ),
                technicalFrontend: this.round2(
                  entry.categorySums.technicalFrontend / entry.totalEvaluations,
                ),
                mustHave: this.round2(
                  entry.categorySums.mustHave / entry.totalEvaluations,
                ),
                stability: this.round2(
                  entry.categorySums.stability / entry.totalEvaluations,
                ),
                usability: this.round2(
                  entry.categorySums.usability / entry.totalEvaluations,
                ),
              }
            : {
                technicalBackend: 0,
                technicalDatabase: 0,
                technicalFrontend: 0,
                mustHave: 0,
                stability: 0,
                usability: 0,
              },
        rounds: roundRows.sort((a, b) => a.roundTitle.localeCompare(b.roundTitle)),
      };
    });

    rows.sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }

      return a.teamName.localeCompare(b.teamName);
    });

    return {
      tournament,
      scoring: {
        scale: '0-100',
        totalFormula: 'sum(roundAverageScore)',
        roundFormula: 'average(juryEvaluationTotals)',
        evaluationFormula: 'average(6 category scores)',
      },
      rows: rows.map((entry, index) => ({
        rank: index + 1,
        ...entry,
      })),
    };
  }

  async exportTournamentLeaderboardCsv(tournamentId: string) {
    const sheet = await this.buildTournamentLeaderboardSheet(tournamentId);

    return [sheet.headers, ...sheet.rows]
      .map((entry) => entry.map((value) => this.escapeCsv(value)).join(','))
      .join('\n');
  }

  async exportTournamentLeaderboardToGoogleSheets(
    tournamentId: string,
    options: GoogleSheetsExportOptions = {},
  ) {
    const config = await this.systemIntegrationsService.getGoogleSheetsConfig();
    if (!config?.webhookUrl) {
      throw new ServiceUnavailableException(
        'Google Sheets export is not configured',
      );
    }

    const sheet = await this.buildTournamentLeaderboardSheet(tournamentId);
    const payload = {
      event: 'leaderboard_export',
      tournament: sheet.tournament,
      scoring: sheet.scoring,
      headers: sheet.headers,
      rows: sheet.rows,
      rowObjects: sheet.rowObjects,
      generatedAt: new Date().toISOString(),
      sheetName:
        options.sheetName?.trim() ||
        config.defaultSheetName ||
        `${sheet.tournament.title} Leaderboard`,
      exportedBy: options.exportedBy ?? null,
      configSource: config.source,
    };

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
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new BadGatewayException(
        `Google Sheets webhook responded with ${response.status}`,
      );
    }

    const contentType = response.headers.get('content-type') ?? '';
    let responsePayload: unknown = null;

    if (contentType.includes('application/json')) {
      responsePayload = (await response.json()) as unknown;
    } else {
      const text = await response.text();
      responsePayload = text.length > 0 ? text : null;
    }

    return {
      ok: true,
      destination: 'google-sheets',
      sheetName: payload.sheetName,
      rowsExported: sheet.rowObjects.length,
      response: responsePayload,
    };
  }

  async buildTournamentLeaderboardSheet(tournamentId: string) {
    const leaderboard = await this.getTournamentLeaderboard(tournamentId);
    const headers = [
      'rank',
      'teamName',
      'organization',
      'totalScore',
      'averageScore',
      'evaluationsCount',
      'technicalBackend',
      'technicalDatabase',
      'technicalFrontend',
      'mustHave',
      'stability',
      'usability',
      'rounds',
    ];

    const rowObjects = leaderboard.rows.map((row) => ({
      rank: row.rank,
      teamName: row.teamName,
      organization: row.organization ?? '',
      totalScore: row.totalScore,
      averageScore: row.averageScore,
      evaluationsCount: row.evaluationsCount,
      technicalBackend: row.categoryAverages.technicalBackend,
      technicalDatabase: row.categoryAverages.technicalDatabase,
      technicalFrontend: row.categoryAverages.technicalFrontend,
      mustHave: row.categoryAverages.mustHave,
      stability: row.categoryAverages.stability,
      usability: row.categoryAverages.usability,
      rounds: row.rounds
        .map(
          (round) =>
            `${round.roundTitle}: avg=${round.averageScore}, evaluations=${round.evaluationsCount}`,
        )
        .join(' | '),
    }));

    const rows = rowObjects.map((row) => [
      row.rank,
      row.teamName,
      row.organization,
      row.totalScore,
      row.averageScore,
      row.evaluationsCount,
      row.technicalBackend,
      row.technicalDatabase,
      row.technicalFrontend,
      row.mustHave,
      row.stability,
      row.usability,
      row.rounds,
    ]);

    return {
      tournament: leaderboard.tournament,
      scoring: leaderboard.scoring,
      headers,
      rows,
      rowObjects,
    };
  }

  private round2(value: number) {
    return Number(value.toFixed(2));
  }

  private escapeCsv(value: string | number) {
    const normalized = String(value ?? '');
    if (/[",\n]/.test(normalized)) {
      return `"${normalized.replace(/"/g, '""')}"`;
    }

    return normalized;
  }
}
