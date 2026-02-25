import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  health() {
    return {
      service: 'falconarena-backend',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
