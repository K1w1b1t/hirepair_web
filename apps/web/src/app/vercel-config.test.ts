import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface VercelConfig {
  framework?: string;
  installCommand?: string;
  buildCommand?: string;
}

describe('Vercel monorepo configuration', () => {
  it('scopes the Next.js configuration to the web project root', () => {
    const repositoryRootConfig = resolve(process.cwd(), '../../vercel.json');
    const webConfig = resolve(process.cwd(), 'vercel.json');

    expect(existsSync(repositoryRootConfig)).toBe(false);

    const config = JSON.parse(readFileSync(webConfig, 'utf8')) as VercelConfig;
    expect(config).toMatchObject({
      framework: 'nextjs',
      installCommand: 'npm ci --include-workspace-root --workspace=@hirepair/web',
      buildCommand: 'npm run build --workspace=@hirepair/web',
    });
  });
});
