import { apiDocsEnabled, parseCorsOrigins } from './http-config';

describe('HTTP environment helpers', () => {
  it('parses a JSON origin list and rejects invalid values', () => {
    expect(parseCorsOrigins('["https://hirepair.com.br","http://localhost:3000"]')).toEqual([
      'https://hirepair.com.br',
      'http://localhost:3000',
    ]);
    expect(() => parseCorsOrigins('https://hirepair.com.br')).toThrow(/CORS_ORIGIN/);
    expect(() => parseCorsOrigins('[]')).toThrow(/CORS_ORIGIN/);
  });
  it('enables docs outside production or by explicit opt-in', () => {
    expect(apiDocsEnabled('development')).toBe(true);
    expect(apiDocsEnabled('production')).toBe(false);
    expect(apiDocsEnabled('production', 'true')).toBe(true);
  });
});
