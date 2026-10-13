import type { AuthContext } from './auth.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by the `authenticate` middleware; undefined on public routes. */
      auth?: AuthContext;
    }
  }
}

export {};
