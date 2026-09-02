import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Em flat config o eslint-config-next nao traz os ignores do .eslintrc, entao
  // `eslint .` varreria a saida do build. Sem isto o lint passa antes do build
  // e falha depois, so pela ordem em que os comandos rodam.
  {
    ignores: ['.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
];

export default eslintConfig;
