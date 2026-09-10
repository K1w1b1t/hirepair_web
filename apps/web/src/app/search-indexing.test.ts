import { createRootMetadata, isSearchIndexingEnabled } from './search-indexing';

describe('isSearchIndexingEnabled', () => {
  it.each([
    ['true', true],
    ['false', false],
    [undefined, false],
    ['invalid', false],
  ])('returns %s for %s', (value, expected) => {
    expect(isSearchIndexingEnabled(value)).toBe(expected);
  });
});

describe('createRootMetadata', () => {
  it('emits noindex metadata when indexing is disabled', () => {
    const metadata = createRootMetadata({
      NEXT_PUBLIC_SITE_URL: 'https://stg.hirepair.com.br',
      SEARCH_INDEXING_ENABLED: 'false',
    });

    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.metadataBase).toEqual(new URL('https://stg.hirepair.com.br'));
  });

  it('emits indexable metadata only when indexing is explicitly enabled', () => {
    expect(createRootMetadata({ SEARCH_INDEXING_ENABLED: 'true' }).robots).toEqual({
      index: true,
      follow: true,
    });
  });
});
