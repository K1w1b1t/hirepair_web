import { normalizeRoutePath } from './route-path.util';

describe('normalizeRoutePath', () => {
  it.each([
    [undefined, '/'],
    ['', '/'],
    ['/health/db/', '/health/db'],
    ['/resumes/9f2a1b3c-4d5e-6f70-8a9b-0c1d2e3f4a5b?download=true', '/resumes/:id'],
    ['/sessions/123#details', '/sessions/:id'],
    ['/files/abcdef123456abcdef123456', '/files/:id'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeRoutePath(input)).toBe(expected);
  });
});
