import robots from './robots';

describe('robots', () => {
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
});
