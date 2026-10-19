/** Log only the route pattern declared by the server, never attacker-controlled URL segments. */
export function requestRoute(request: { route?: unknown; url?: string }): string {
  const route = request.route;
  return route && typeof route === 'object' && 'path' in route && typeof route.path === 'string'
    ? route.path
    : '/unmatched';
}
