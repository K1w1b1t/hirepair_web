import {
  createRootMetadata,
  currentSearchEnvironment,
  isSearchIndexingEnabled,
} from './search-indexing';

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

describe('isSearchIndexingEnabled', () => {
  it.each([
    ['true', true],
    ['false', false],
    [undefined, false],
    ['invalid', false],
  ])('returns %s for %s', (value, expected) => {
    expect(isSearchIndexingEnabled(value)).toBe(expected);
  });

  it('reads the default value from the server environment', () => {
    const previous = process.env.SEARCH_INDEXING_ENABLED;
    process.env.SEARCH_INDEXING_ENABLED = 'true';

    expect(isSearchIndexingEnabled()).toBe(true);

    restoreEnvironment('SEARCH_INDEXING_ENABLED', previous);
  });
});

describe('currentSearchEnvironment', () => {
  it('selects only the variables used by search metadata', () => {
    const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const previousIndexing = process.env.SEARCH_INDEXING_ENABLED;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://hirepair.com.br';
    process.env.SEARCH_INDEXING_ENABLED = 'true';

    expect(currentSearchEnvironment()).toEqual({
      NEXT_PUBLIC_SITE_URL: 'https://hirepair.com.br',
      SEARCH_INDEXING_ENABLED: 'true',
    });

    restoreEnvironment('NEXT_PUBLIC_SITE_URL', previousSiteUrl);
    restoreEnvironment('SEARCH_INDEXING_ENABLED', previousIndexing);
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
