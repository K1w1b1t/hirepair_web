import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

/**
 * Extrai os campos da constraint unica violada.
 *
 * Duas formas, porque as duas aparecem: `meta.target` e o formato do query engine
 * classico, e `driverAdapterError` e o do `@prisma/adapter-pg` (que monta o erro a
 * partir do DETAIL do Postgres). O Postgres coloca identificador com maiuscula
 * entre aspas nesse DETAIL — daqui saem nomes como `"userId"`, e por isso as
 * aspas sao removidas antes de qualquer comparacao.
 */
function extractUniqueFields(exception: Prisma.PrismaClientKnownRequestError): string[] {
  const raw = Array.isArray(exception.meta?.target)
    ? (exception.meta.target as string[])
    : (
        exception.meta?.['driverAdapterError'] as
          { cause?: { constraint?: { fields?: unknown } } } | undefined
      )?.cause?.constraint?.fields;

  if (!Array.isArray(raw)) {
    return [];
  }

  return (raw as string[]).map((field) => field.replace(/^"(.*)"$/, '$1'));
}

function resolveConflictMessage(
  exception: Prisma.PrismaClientKnownRequestError,
  request: Request,
): string {
  const fields = extractUniqueFields(exception);
  const body = (request.body ?? {}) as Record<string, unknown>;

  // Preferir o campo que o cliente de fato enviou: numa unique composta como
  // ([profileId, kind, name]), nomear `profileId` nao diz nada a quem chamou.
  const duplicated = fields.find((field) => field in body) ?? fields[0];

  return duplicated ? `O campo "${duplicated}" ja esta em uso.` : 'Registro duplicado.';
}

/**
 * Traduz erro conhecido do Prisma em resposta HTTP.
 *
 * Sem isto, uma violacao de unique vira 500 — erro de servidor para o que e, na
 * verdade, entrada invalida do cliente.
 *
 * Por ora so P2002 (unique) e traduzido — e o unico com traducao inequivoca sem
 * conhecer a rota. Todo o resto vira 500 com log: mapear codigo de Prisma a
 * status HTTP no chute vazaria detalhe de schema na resposta. P2025 (registro nao
 * encontrado) entra quando houver rota de leitura por id para dar sentido a um
 * 404 — hoje nao ha.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    if (exception.code === 'P2002') {
      const conflict = new ConflictException(resolveConflictMessage(exception, request));

      response.status(conflict.getStatus()).json(conflict.getResponse());
      return;
    }

    this.logger.error(
      `Erro nao tratado do Prisma (${exception.code}) em ${request.method} ${request.url}`,
      exception.stack,
    );

    const fallback = new HttpException(
      'Erro interno ao acessar o banco de dados.',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );

    response.status(fallback.getStatus()).json(fallback.getResponse());
  }
}
