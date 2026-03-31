import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RATE_LIMIT_KEY,
  type RateLimitOptions,
} from '../decorators/rate-limit.decorator';
import { RateLimitService } from '../services/rate-limit.service';

type RequestLike = {
  ip?: string;
  body?: {
    email?: string;
  };
  user?: {
    userId?: string;
  };
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options || context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestLike>();
    const key = this.resolveKey(request, options);

    if (!key) {
      return true;
    }

    const result = this.rateLimitService.consume({
      bucket: options.bucket,
      key,
      limit: options.limit,
      windowSeconds: options.windowSeconds,
    });

    if (!result.allowed) {
      throw new HttpException(
        'Too many requests, please try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private resolveKey(
    request: RequestLike,
    options: RateLimitOptions,
  ): string | null {
    switch (options.keyStrategy) {
      case 'email': {
        const email = request.body?.email?.trim().toLowerCase();
        return email || request.ip || null;
      }
      case 'user':
        return request.user?.userId ?? request.ip ?? null;
      case 'ip':
      default:
        return request.ip ?? null;
    }
  }
}
