import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

type ErrorReportInput = {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  message: string;
  stack?: string | null;
  userId?: string | null;
  userRole?: 'ADMIN' | 'TEAM' | 'JURY' | 'ORGANIZER' | null;
  userEmail?: string | null;
};

@Injectable()
export class ErrorReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private get errorReports() {
    return (this.prisma as PrismaService & { errorReport: any }).errorReport;
  }

  async create(input: ErrorReportInput) {
    return this.errorReports.create({
      data: {
        requestId: input.requestId,
        method: input.method,
        path: input.path,
        statusCode: input.statusCode,
        message: input.message,
        stack: input.stack ?? null,
        userId: input.userId ?? null,
        userRole: input.userRole ?? null,
        userEmail: input.userEmail ?? null,
      },
    });
  }

  async getRecent(limit = 50) {
    return this.errorReports.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }
}
