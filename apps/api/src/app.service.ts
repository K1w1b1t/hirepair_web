import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealthStatus(): { message: string; status: string; timestamp: string } {
    return {
      message: 'HirePair API Operational',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
