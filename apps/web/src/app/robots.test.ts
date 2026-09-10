import robots from './robots';

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

describe('robots', () => {
  const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const previousIndexing = process.env.SEARCH_INDEXING_ENABLED;

  afterEach(() => {
    restoreEnvironment('NEXT_PUBLIC_SITE_URL', previousSiteUrl);
    restoreEnvironment('SEARCH_INDEXING_ENABLED', previousIndexing);
  });

  it('allows crawlers to read noindex metadata in staging without advertising a sitemap', () => {
    expect(robots({ SEARCH_INDEXING_ENABLED: 'false' })).toEqual({
      rules: { userAgent: '*', allow: '/' },
    });
  });

  it('advertises the production sitemap only when indexing is enabled', () => {
    expect(
      robots({
        NEXT_PUBLIC_SITE_URL: 'https://hirepair.com.br',
        SEARCH_INDEXING_ENABLED: 'true',
      }),
    ).toEqual({
      rules: { userAgent: '*', allow: '/' },
      sitemap: 'https://hirepair.com.br/sitemap.xml',
      host: 'https://hirepair.com.br',
    });
  });

  it('uses the server environment by default', () => {
    process.env.SEARCH_INDEXING_ENABLED = 'false';

    expect(robots()).toEqual({ rules: { userAgent: '*', allow: '/' } });
  });
});
