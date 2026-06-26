function jwtRole(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')),
    ) as { role?: string };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export function isAuthorizedMaintenanceRequest(
  authHeader: string,
  cronSecret: string,
  headerCronSecret: string,
  serviceRoleKey: string,
): boolean {
  if (cronSecret && headerCronSecret === cronSecret) return true;

  const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!bearer) return false;
  if (serviceRoleKey && bearer === serviceRoleKey.trim()) return true;

  return jwtRole(bearer) === 'service_role';
}
