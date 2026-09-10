import type { MetadataRoute } from 'next';
import {
  currentSearchEnvironment,
  isSearchIndexingEnabled,
  siteUrl,
  type SearchEnvironment,
} from './search-indexing';

export default function sitemap(
  environment: SearchEnvironment = currentSearchEnvironment(),
): MetadataRoute.Sitemap {
  if (!isSearchIndexingEnabled(environment.SEARCH_INDEXING_ENABLED)) {
    return [];
  }

  return [
    {
      url: `${siteUrl(environment.NEXT_PUBLIC_SITE_URL)}/`,
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
