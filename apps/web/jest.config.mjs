import nextJest from 'next/jest.js';

// next/jest carrega next.config.ts, os aliases do tsconfig e o transform SWC —
// sem ele o Jest nao entende JSX nem o alias `@/*`.
// Config em .mjs (e nao .ts) porque config TypeScript exigiria `ts-node` so
// para ler este arquivo.
const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  coverageDirectory: 'coverage',
  testPathIgnorePatterns: ['<rootDir>/e2e/'],
};

export default createJestConfig(config);
