import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { REQUEST_ID_HEADER, resolveRequestId } from './http-observability';

@Injectable()
export class HttpRequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    const requestId = resolveRequestId(request);

    Object.assign(request, { requestId });
    response.setHeader(REQUEST_ID_HEADER, requestId);

    next();
  }
}
