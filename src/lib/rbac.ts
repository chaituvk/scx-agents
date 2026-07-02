export type Role = 'viewer' | 'agent' | 'admin' | 'superadmin';

export interface Permission {
  resource: string;  // e.g. 'agents', 'journeys', 'knowledge', 'insights'
  action: string;    // 'read', 'write', 'delete', 'admin'
}

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  viewer: [
    { resource: 'agents', action: 'read' },
    { resource: 'conversations', action: 'read' },
    { resource: 'insights', action: 'read' },
    { resource: 'journeys', action: 'read' },
    { resource: 'knowledge', action: 'read' },
  ],
  agent: [
    { resource: 'agents', action: 'read' },
    { resource: 'conversations', action: 'read' },
    { resource: 'conversations', action: 'write' },
    { resource: 'insights', action: 'read' },
    { resource: 'journeys', action: 'read' },
    { resource: 'knowledge', action: 'read' },
  ],
  admin: [
    { resource: '*', action: 'read' },
    { resource: '*', action: 'write' },
    { resource: '*', action: 'delete' },
  ],
  superadmin: [
    { resource: '*', action: '*' },
  ],
};

export function hasPermission(role: string, resource: string, action: string): boolean {
  const permissions = ROLE_PERMISSIONS[role as Role] ?? ROLE_PERMISSIONS['viewer'];
  return permissions.some(p =>
    (p.resource === '*' || p.resource === resource) &&
    (p.action === '*' || p.action === action)
  );
}

export function requirePermission(role: string, resource: string, action: string): void {
  if (!hasPermission(role, resource, action)) {
    throw new Error(`Forbidden: role '${role}' cannot '${action}' '${resource}'`);
  }
}
