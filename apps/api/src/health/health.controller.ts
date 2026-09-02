import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { type DatabaseHealth, HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * `GET /health/db`.
   *
   * Sempre 200, com o veredito no corpo (ver HealthService.checkDatabase). Quem
   * monitora deve olhar `database`, nao o status HTTP.
   */
  @Get('db')
  @HttpCode(HttpStatus.OK)
  checkDatabase(): Promise<DatabaseHealth> {
    return this.healthService.checkDatabase();
  }
}
