export const REQUEST_CONTEXT_KEYS = {
  ACTOR_ID: 'actorId',
  ACTOR_ROLE: 'actorRole',
  GLOBAL_TRACE_ID: 'globalTraceId',
  HTTP_METHOD: 'httpMethod',
  HTTP_URL: 'httpUrl',
  HTTP_ROUTE: 'httpRoute',
  DB_METRICS: 'dbMetrics',
} as const;

export interface DbRequestMetrics {
  statementCount: number;
  totalMs: number;
}

export const SYSTEM_ACTOR_ID = 'SYSTEM';
export const GLOBAL_TRACE_ID_HEADER = 'x-global-trace-id';
