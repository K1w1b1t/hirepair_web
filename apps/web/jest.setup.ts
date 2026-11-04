import '@testing-library/jest-dom';
// jsdom has no viewport scrolling; the real transition is covered in Playwright.
window.scrollTo = jest.fn();

import { TextEncoder } from 'node:util';
import { webcrypto } from 'node:crypto';
Object.defineProperty(globalThis, 'TextEncoder', { value: TextEncoder });
Object.defineProperty(globalThis.crypto, 'subtle', { value: webcrypto.subtle });
