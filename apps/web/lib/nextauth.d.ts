/**
 * Type augmentation: with JWT sessions (no database adapter), Auth.js's
 * default `Session["user"]` doesn't include `id`. We stash the user id
 * on the JWT and mirror it onto the session in the session callback, so
 * expose that shape to the rest of the app.
 */
import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
