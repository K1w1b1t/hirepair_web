import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Contrato de ambiente da API.
 *
 * Validado no boot, e nao no primeiro uso: subir com `DATABASE_URL` ausente e
 * falhar na primeira requisicao e pior do que nao subir — o processo fica de pe
 * respondendo erro, e o deploy passa por saudavel.
 */
export class EnvironmentVariables {
  @IsOptional()
  @IsIn(['development', 'test', 'production'])
  NODE_ENV?: 'development' | 'test' | 'production';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  /**
   * Conexao usada pela aplicacao em runtime. Em producao aponta para o pooler em
   * modo transaction do Supabase (porta 6543).
   */
  @IsString()
  @MinLength(1)
  DATABASE_URL!: string;

  /**
   * Conexao direta, usada apenas por `prisma migrate` (o pooler em modo
   * transaction nao sustenta o advisory lock da migration). Opcional: quando
   * ausente, o Prisma cai para `DATABASE_URL`, o que e o certo em ambiente local,
   * onde as duas seriam iguais.
   */
  @IsOptional()
  @IsString()
  @MinLength(1)
  DIRECT_URL?: string;

  /** Tamanho do pool do Prisma. Ver PrismaService para o valor padrao e o porque. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  PRISMA_CONNECTION_LIMIT?: number;

  /** Origem liberada no CORS. Consumida por main.ts. */
  @IsOptional()
  @IsString()
  NEXT_PUBLIC_SITE_URL?: string;
}

/**
 * Passado ao `ConfigModule.forRoot({ validate })`. Lanca no boot quando o
 * ambiente esta incompleto.
 */
export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    // O ambiente e sempre string; sem isto, PORT="3001" reprovaria em @IsInt.
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(
      `Configuracao de ambiente invalida:\n${errors
        .map((error) => `  - ${Object.values(error.constraints ?? {}).join(', ')}`)
        .join('\n')}`,
    );
  }

  return validated;
}
