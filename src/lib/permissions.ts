import { Role } from "@prisma/client";

// Coarse-grained capability model. Higher roles inherit lower-role abilities.
export const ROLE_RANK: Record<Role, number> = {
  EMPLOYEE: 1,
  MANAGER: 2,
  BUSINESS_OWNER: 3,
  SUPER_ADMIN: 4,
};

export type Permission =
  | "schedule:read"
  | "schedule:write"
  | "schedule:publish"
  | "employee:read"
  | "employee:write"
  | "org:write"
  | "leave:read"
  | "leave:request"
  | "leave:approve"
  | "swap:request"
  | "swap:approve"
  | "timesheet:clock"
  | "timesheet:approve"
  | "report:read"
  | "settings:write"
  | "tenant:manage";

const MANAGER_PERMS: Permission[] = [
  "schedule:read", "schedule:write", "schedule:publish",
  "employee:read", "employee:write", "org:write",
  "leave:read", "leave:request", "leave:approve",
  "swap:request", "swap:approve",
  "timesheet:clock", "timesheet:approve",
  "report:read",
];

const EMPLOYEE_PERMS: Permission[] = [
  "schedule:read", "leave:request", "swap:request", "timesheet:clock",
];

const PERMISSIONS: Record<Role, Permission[]> = {
  EMPLOYEE: EMPLOYEE_PERMS,
  MANAGER: MANAGER_PERMS,
  BUSINESS_OWNER: [...MANAGER_PERMS, "settings:write"],
  SUPER_ADMIN: [...MANAGER_PERMS, "settings:write", "tenant:manage"],
};

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function isManagerOrAbove(role: Role): boolean {
  return hasAtLeast(role, Role.MANAGER);
}
