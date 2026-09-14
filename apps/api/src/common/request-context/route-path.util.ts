const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC = /^\d+$/;
const LONG_HEX = /^[0-9a-f]{24,}$/i;
const OPAQUE_ID = /^(?=.*\d)[A-Za-z0-9_-]{20,}$/;

function isIdSegment(segment: string): boolean {
  return (
    UUID.test(segment) || NUMERIC.test(segment) || LONG_HEX.test(segment) || OPAQUE_ID.test(segment)
  );
}

export function normalizeRoutePath(url: string | undefined): string {
  if (!url) return '/';

  const pathOnly = url.split(/[?#]/, 1)[0];
  const normalized = pathOnly
    .split('/')
    .map((segment) => (isIdSegment(segment) ? ':id' : segment))
    .join('/');

  if (normalized.length > 1 && normalized.endsWith('/')) {
    return normalized.slice(0, -1);
  }
  return normalized || '/';
}
