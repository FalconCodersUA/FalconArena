import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { ErrorReportsService } from './error-reports.service';

@Catch()
export class HttpErrorReportingFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(HttpErrorReportingFilter.name);

  constructor(private readonly errorReportsService: ErrorReportsService) {
    super();
  }

  override async catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() === 'http') {
      const http = host.switchToHttp();
      const request = http.getRequest<{
        method?: string;
        originalUrl?: string;
        url?: string;
        requestId?: string;
        user?: {
          userId?: string;
          role?: 'ADMIN' | 'TEAM' | 'JURY' | 'ORGANIZER';
          email?: string;
        };
      }>();
      const statusCode =
        exception instanceof HttpException
          ? exception.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

      if (statusCode >= 500) {
        const message =
          exception instanceof Error
            ? exception.message
            : exception instanceof HttpException
              ? exception.message
              : 'Unhandled backend error';

        try {
          await this.errorReportsService.create({
            requestId: request.requestId ?? 'unknown',
            method: request.method ?? 'UNKNOWN',
            path: request.originalUrl ?? request.url ?? '/',
            statusCode,
            message,
            stack: exception instanceof Error ? exception.stack ?? null : null,
            userId: request.user?.userId ?? null,
            userRole: request.user?.role ?? null,
            userEmail: request.user?.email ?? null,
          });
        } catch (reportingError) {
          this.logger.error(
            `Failed to persist error report: ${
              reportingError instanceof Error
                ? reportingError.message
                : 'unknown reporting error'
            }`,
          );
        }
      }
    }

    super.catch(exception, host);
  }
}
