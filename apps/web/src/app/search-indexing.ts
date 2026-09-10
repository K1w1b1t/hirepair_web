import type { Metadata } from 'next';

const FALLBACK_SITE_URL = 'https://hirepair.com.br';

export interface SearchEnvironment {
  NEXT_PUBLIC_SITE_URL?: string;
  SEARCH_INDEXING_ENABLED?: string;
}

export function currentSearchEnvironment(): SearchEnvironment {
  return {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    SEARCH_INDEXING_ENABLED: process.env.SEARCH_INDEXING_ENABLED,
  };
}

/** Search indexing is opt-in so an unconfigured deployment remains private to search engines. */
export function isSearchIndexingEnabled(value = process.env.SEARCH_INDEXING_ENABLED): boolean {
  return value === 'true';
}

export function siteUrl(value = process.env.NEXT_PUBLIC_SITE_URL): string {
  return (value ?? FALLBACK_SITE_URL).replace(/\/+$/, '');
}

export function createRootMetadata(
  environment: SearchEnvironment = currentSearchEnvironment(),
): Metadata {
  const canIndex = isSearchIndexingEnabled(environment.SEARCH_INDEXING_ENABLED);

  return {
    metadataBase: new URL(siteUrl(environment.NEXT_PUBLIC_SITE_URL)),
    title: 'HirePair | Currículos claros para novas oportunidades',
    description:
      'O HirePair está construindo uma forma simples de organizar experiências e criar um currículo claro, pronto para processos seletivos.',
    alternates: { canonical: '/' },
    icons: { icon: '/hirepair-logo.png' },
    robots: { index: canIndex, follow: canIndex },
    openGraph: {
      title: 'HirePair | Currículos claros para novas oportunidades',
      description:
        'Uma forma simples de organizar experiências e criar um currículo claro, pronto para processos seletivos.',
      type: 'website',
      url: '/',
      locale: 'pt_BR',
    },
  };
}
