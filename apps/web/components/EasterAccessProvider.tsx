'use client';

import { createContext, useContext, type ReactNode } from 'react';

// Boolean-only context. The hashing / fingerprint logic lives in
// lib/easter-access.ts and only runs server-side — the client never
// sees the salt, the fingerprints, or the check function.
const EasterAccessContext = createContext<boolean>(false);

export function EasterAccessProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return <EasterAccessContext.Provider value={enabled}>{children}</EasterAccessContext.Provider>;
}

export function useEasterAccess(): boolean {
  return useContext(EasterAccessContext);
}
