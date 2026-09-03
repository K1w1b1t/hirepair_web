import { validate } from './env.validation';

const VALID_URL = 'postgresql://user:pass@localhost:5434/hirepair?schema=public';

describe('validate (ambiente)', () => {
  it('aceita o minimo: apenas DATABASE_URL', () => {
    expect(validate({ DATABASE_URL: VALID_URL }).DATABASE_URL).toBe(VALID_URL);
  });

  it('reprova ambiente sem DATABASE_URL', () => {
    // O caso que justifica a validacao existir: sem isto a API sobe e so quebra
    // na primeira requisicao, quando o deploy ja passou por saudavel.
    expect(() => validate({})).toThrow(/DATABASE_URL/);
  });

  it('reprova DATABASE_URL vazia', () => {
    expect(() => validate({ DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
  });

  it('converte PORT de string para numero', () => {
    // O ambiente entrega tudo como string; sem enableImplicitConversion isto
    // reprovaria em @IsInt.
    expect(validate({ DATABASE_URL: VALID_URL, PORT: '3001' }).PORT).toBe(3001);
  });

  it('reprova PORT fora da faixa', () => {
    expect(() => validate({ DATABASE_URL: VALID_URL, PORT: '70000' })).toThrow();
  });

  it('reprova NODE_ENV desconhecido', () => {
    expect(() => validate({ DATABASE_URL: VALID_URL, NODE_ENV: 'staging' })).toThrow();
  });

  it('aceita DIRECT_URL e PRISMA_CONNECTION_LIMIT quando presentes', () => {
    const result = validate({
      DATABASE_URL: VALID_URL,
      DIRECT_URL: VALID_URL,
      PRISMA_CONNECTION_LIMIT: '25',
    });

    expect(result.DIRECT_URL).toBe(VALID_URL);
    expect(result.PRISMA_CONNECTION_LIMIT).toBe(25);
  });

  it('reprova PRISMA_CONNECTION_LIMIT zero', () => {
    expect(() => validate({ DATABASE_URL: VALID_URL, PRISMA_CONNECTION_LIMIT: '0' })).toThrow();
  });

  it('aceita Redis remoto por URL TLS', () => {
    const result = validate({
      DATABASE_URL: VALID_URL,
      REDIS_URL: 'rediss://default:secret@eu1-example.upstash.io:6379',
    });

    expect(result.REDIS_URL).toContain('upstash.io');
  });

  it('converte REDIS_PORT para numero e reprova porta invalida', () => {
    expect(validate({ DATABASE_URL: VALID_URL, REDIS_PORT: '6379' }).REDIS_PORT).toBe(6379);
    expect(() => validate({ DATABASE_URL: VALID_URL, REDIS_PORT: '0' })).toThrow();
  });

  it('aceita configuracao opcional dos provedores de IA', () => {
    const result = validate({
      DATABASE_URL: VALID_URL,
      GEMINI_API_KEY: 'gemini-key',
      GROQ_API_KEY: 'groq-key',
      AI_REQUEST_TIMEOUT_MS: '15000',
    });

    expect(result.GEMINI_API_KEY).toBe('gemini-key');
    expect(result.GROQ_API_KEY).toBe('groq-key');
    expect(result.AI_REQUEST_TIMEOUT_MS).toBe(15000);
  });

  it('ignora variaveis nao declaradas', () => {
    // process.env inteiro e passado ao validate; chave desconhecida nao pode
    // derrubar o boot.
    expect(() =>
      validate({ DATABASE_URL: VALID_URL, PATH: '/usr/bin', HOME: '/root' }),
    ).not.toThrow();
  });
});
