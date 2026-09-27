/**
 * Express Request augmentation.
 *
 * Why a regular `.ts` file (not `.d.ts`): Vercel's @vercel/backends builder
 * only picks up ambient declarations from files that are part of the
 * compilation graph. Side-effect importing this file from `app.ts` and
 * `index.ts` guarantees it's always loaded.
 */

export interface AuthUser {
  id: string;
  email: string;
}

export type ProjectRole = 'admin' | 'member' | 'viewer';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      /** Resolved project membership for the current request, set by requireProjectRole. */
      projectRole?: ProjectRole;
      projectId?: string;
    }
  }
}
