import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { buildHttpLogEntry } from './http-observability';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const startedAt = Date.now();
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse();

    return next.handle().pipe(
      tap({
        next: () => {
          const logEntry = buildHttpLogEntry({
            request,
            response,
            durationMs: Date.now() - startedAt,
            requestId: request.requestId ?? 'unknown',
          });

          this.logger.log(JSON.stringify(logEntry));
        },
        error: (error: unknown) => {
          const message =
            error instanceof Error ? error.message : 'Unhandled HTTP error';

          const logEntry = buildHttpLogEntry({
            request,
            response,
            durationMs: Date.now() - startedAt,
            requestId: request.requestId ?? 'unknown',
            errorMessage: message,
          });

          this.logger.error(JSON.stringify(logEntry));
        },
      }),
    );
  }
}
