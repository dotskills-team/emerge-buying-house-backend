import type { AuthContext } from '../core/auth/types/index.js';

declare global {
  namespace Express {
    interface Locals {
      /** Set by the require-auth middleware; absent on public routes. */
      auth?: AuthContext;
    }
  }
}

export {};
