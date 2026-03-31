import { SetMetadata } from '@nestjs/common';

export type RateLimitKeyStrategy = 'ip' | 'email' | 'user';

export type RateLimitOptions = {
  bucket: string;
  limit: number;
  windowSeconds: number;
  keyStrategy: RateLimitKeyStrategy;
};

export const RATE_LIMIT_KEY = 'rate-limit-options';

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);
