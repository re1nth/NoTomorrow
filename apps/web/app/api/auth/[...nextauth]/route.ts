/**
 * Auth.js catch-all: /api/auth/signin, /api/auth/callback/google, and
 * everything else Auth.js expects. Only loaded in cloud mode — nothing
 * in local (desktop) mode ever requests these URLs.
 */
import { handlers } from '@/lib/nextauth';

export const { GET, POST } = handlers;
