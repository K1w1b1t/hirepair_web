import type { MetadataRoute } from 'next';
import {
  currentSearchEnvironment,
  isSearchIndexingEnabled,
  siteUrl,
  type SearchEnvironment,
} from './search-indexing';

export default function robots(
  environment: SearchEnvironment = currentSearchEnvironment(),
): MetadataRoute.Robots {
  if (!isSearchIndexingEnabled(environment.SEARCH_INDEXING_ENABLED)) {
    return { rules: { userAgent: '*', allow: '/' } };
  }

  const origin = siteUrl(environment.NEXT_PUBLIC_SITE_URL);

  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
