import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from '../src/ai/ai.module';
import { AiService } from '../src/ai/ai.service';
import { OperationalModule } from '../src/operational/operational.module';
import { evaluateInterview } from '../src/interview/evaluation';
@Module({ imports: [ConfigModule.forRoot({ isGlobal: true }), OperationalModule, AiModule] })
class EvalModule {}
async function main() {
  const options = {
    live: process.argv.includes('--live'),
    judge: process.argv.includes('--judge'),
    caseIds: process.argv.includes('--cases')
      ? (process.argv[process.argv.indexOf('--cases') + 1] ?? '').split(',')
      : undefined,
  };
  const app = options.live
    ? await NestFactory.createApplicationContext(EvalModule, { logger: false })
    : null;
  try {
    const report = await evaluateInterview(options, app?.get(AiService));
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    if (!report.pass) process.exitCode = 1;
  } finally {
    await app?.close();
  }
}
void main().catch(() => {
  process.stderr.write(
    'Eval falhou: erro de execução ou infraestrutura; não é aprovação de qualidade.\n',
  );
  process.exitCode = 1;
});
