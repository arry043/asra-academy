import { z } from 'zod';

/**
 * Imported FIRST by index.ts (PHASE 14). Zod 4 decides per object schema, when the schema is
 * constructed, whether to compile a fast parser with `new Function` — probing eval support once.
 * The web app's CSP has no 'unsafe-eval', and browsers report that swallowed probe as a CSP
 * violation. In browsers only, Zod therefore runs jitless; Node (the API, SSR) keeps the JIT.
 */
// `globalThis` check: this package is compiled with Node typings (no DOM `window` type).
if ('window' in globalThis) z.config({ jitless: true });
