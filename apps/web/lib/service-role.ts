export const SERVICE_ROLES = ['all', 'web', 'social', 'messaging'] as const;

export type ServiceRole = (typeof SERVICE_ROLES)[number];

export function serviceRole(): ServiceRole {
  const value = process.env.NOTOMORROW_SERVICE_ROLE;
  return SERVICE_ROLES.includes(value as ServiceRole) ? (value as ServiceRole) : 'all';
}

export function pathAllowedForRole(pathname: string, role: ServiceRole): boolean {
  if (role === 'all') return true;
  if (pathname === '/api/health') return true;

  const isSocialApi = pathname === '/api/friends' || pathname.startsWith('/api/friends/');
  const isMessagingApi = pathname === '/api/messages' || pathname.startsWith('/api/messages/');

  if (role === 'social') return isSocialApi;
  if (role === 'messaging') return isMessagingApi;
  return !isSocialApi && !isMessagingApi;
}
