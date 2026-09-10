import sitemap from './sitemap';

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

describe('sitemap', () => {
  const previousIndexing = process.env.SEARCH_INDEXING_ENABLED;

  afterEach(() => {
    restoreEnvironment('SEARCH_INDEXING_ENABLED', previousIndexing);
  });

  it('does not publish staging URLs', () => {
    expect(sitemap({ SEARCH_INDEXING_ENABLED: 'false' })).toEqual([]);
  });

  it('publishes the production landing page', () => {
    expect(
      sitemap({
        NEXT_PUBLIC_SITE_URL: 'https://hirepair.com.br',
        SEARCH_INDEXING_ENABLED: 'true',
      }),
    ).toEqual([
      {
        url: 'https://hirepair.com.br/',
        changeFrequency: 'weekly',
        priority: 1,
      },
    ]);
  });

  it('uses the server environment by default', () => {
    process.env.SEARCH_INDEXING_ENABLED = 'false';

    expect(sitemap()).toEqual([]);
  });
});
