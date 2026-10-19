import '@testing-library/jest-dom';

import { TextEncoder } from 'node:util';
import { webcrypto } from 'node:crypto';
Object.defineProperty(globalThis, 'TextEncoder', { value: TextEncoder });
Object.defineProperty(globalThis.crypto, 'subtle', { value: webcrypto.subtle });
