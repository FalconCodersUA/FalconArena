import { Injectable } from '@nestjs/common';

type RateLimitEntry = {
  count: number;
  expiresAt: number;
};

type ConsumeOptions = {
  bucket: string;
  key: string;
  limit: number;
  windowSeconds: number;
};

@Injectable()
export class RateLimitService {
  private readonly entries = new Map<string, RateLimitEntry>();

  consume(options: ConsumeOptions) {
    const now = Date.now();
    const storageKey = `${options.bucket}:${options.key}`;
    const existing = this.entries.get(storageKey);

    if (!existing || existing.expiresAt <= now) {
      this.entries.set(storageKey, {
        count: 1,
        expiresAt: now + options.windowSeconds * 1000,
      });

      return {
        allowed: true,
        remaining: Math.max(0, options.limit - 1),
      };
    }

    if (existing.count >= options.limit) {
      return {
        allowed: false,
        remaining: 0,
      };
    }

    existing.count += 1;

    return {
      allowed: true,
      remaining: Math.max(0, options.limit - existing.count),
    };
  }
}
