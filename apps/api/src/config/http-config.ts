export function parseCorsOrigins(value: string | undefined): string[] {
  try {
    const parsed = JSON.parse(value ?? '["http://localhost:3000"]') as unknown;
    if (
      !Array.isArray(parsed) ||
      parsed.length === 0 ||
      parsed.some((origin) => typeof origin !== 'string' || !origin)
    )
      throw new Error();
    return parsed as string[];
  } catch {
    throw new Error('CORS_ORIGIN deve ser um array JSON nao vazio de origens.');
  }
}

export function apiDocsEnabled(nodeEnv: string | undefined, configured?: string): boolean {
  return nodeEnv !== 'production' || configured === 'true';
}
