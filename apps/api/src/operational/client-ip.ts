import { isIP } from 'node:net';
import type { Request } from 'express';
import { operationalError } from './operational.config';

export function clientNetwork(request: Request): string {
  const forwarded =
    process.env.VERCEL === '1' ? request.headers['x-vercel-forwarded-for'] : undefined;
  let ip = process.env.VERCEL === '1' ? forwarded : request.socket.remoteAddress;
  if (typeof ip !== 'string' || ip.includes('%') || !isIP(ip))
    throw operationalError('CLIENT_NETWORK_UNAVAILABLE');
  if (ip.startsWith('::ffff:') && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  if (isIP(ip) === 4) return ip;
  // WHATWG URL canonicalizes compressed/equivalent IPv6 spellings.
  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  const [left, right = ''] = canonical.split('::');
  const start = left ? left.split(':') : [];
  const end = right ? right.split(':') : [];
  const groups = canonical.includes('::')
    ? [...start, ...Array<string>(8 - start.length - end.length).fill('0'), ...end]
    : start;
  if (
    groups.slice(0, 5).every((part) => Number.parseInt(part, 16) === 0) &&
    Number.parseInt(groups[5], 16) === 65535
  ) {
    const high = Number.parseInt(groups[6], 16);
    const low = Number.parseInt(groups[7], 16);
    return [high >> 8, high & 255, low >> 8, low & 255].join('.');
  }
  return (
    groups
      .slice(0, 4)
      .map((group) => group.padStart(4, '0'))
      .join(':') + '::/64'
  );
}
