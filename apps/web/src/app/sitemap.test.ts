import sitemap from './sitemap';

describe('sitemap', () => {
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
});
