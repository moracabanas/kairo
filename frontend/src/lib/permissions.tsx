import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

export type Role = "owner" | "admin" | "analyst" | "viewer";

function getOrgId(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return localStorage.getItem("current_org_id") ?? undefined;
}

export const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 4,
  admin: 3,
  analyst: 2,
  viewer: 1,
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  analyst: "Analyst",
  viewer: "Viewer",
};

export const ROLE_COLORS: Record<Role, string> = {
  owner: "bg-purple-500",
  admin: "bg-blue-500",
  analyst: "bg-green-500",
  viewer: "bg-gray-500",
};

export const PERMISSIONS = {
  MANAGE_SIGNALS: ["owner", "admin", "analyst"] as Role[],
  MANAGE_USERS: ["owner", "admin"] as Role[],
  VIEW_AUDIT: ["owner", "admin"] as Role[],
  TRAIN_MODELS: ["owner", "admin", "analyst"] as Role[],
  DELETE_SIGNALS: ["owner"] as Role[],
  DELETE_SIGNAL_DATA: ["owner"] as Role[],
} as const;

export function hasRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function canManageSignals(role: Role): boolean {
  return hasRole(role, "analyst");
}

export function canManageUsers(role: Role): boolean {
  return hasRole(role, "admin");
}

export function canViewAudit(role: Role): boolean {
  return hasRole(role, "admin");
}

export function canTrainModels(role: Role): boolean {
  return hasRole(role, "analyst");
}

export function isOwner(role: Role): boolean {
  return role === "owner";
}

export function hasPermission(
  role: Role,
  permission: keyof typeof PERMISSIONS
): boolean {
  return PERMISSIONS[permission].includes(role);
}

export async function getCurrentUserRole(orgId: string): Promise<Role | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) return null;

  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.user.id)
    .eq("org_id", orgId)
    .single();

  return (user?.role as Role) || null;
}

export async function requireAuth(): Promise<{
  userId: string;
  orgId: string;
  role: Role;
}> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const orgId = getOrgId();
  if (!orgId) {
    redirect("/login");
  }

  const role = await getCurrentUserRole(orgId);
  if (!role) {
    redirect("/login");
  }

  return { userId: session.user.id, orgId, role };
}

export function requireRole(requiredRole: Role) {
  return async function checkRole(): Promise<Role | null> {
    const role = await getCurrentUserRole(
      getOrgId() || ""
    );
    if (!role || !hasRole(role, requiredRole)) {
      return null;
    }
    return role;
  };
}

export function withRoleCheck<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredRole: Role
) {
  return async function ProtectedComponent(props: P) {
    const { role } = await requireAuth();
    if (!hasRole(role, requiredRole)) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
            <p className="text-gray-600 mt-2">
              You need {ROLE_LABELS[requiredRole]} role or higher to access
              this page.
            </p>
          </div>
        </div>
      );
    }
    return <WrappedComponent {...props} />;
  };
}

export function usePermissionCheck() {
  const checkPermission = async (
    permission: keyof typeof PERMISSIONS,
    orgId?: string
  ): Promise<boolean> => {
    const targetOrgId = orgId || getOrgId();
    if (!targetOrgId) return false;

    const role = await getCurrentUserRole(targetOrgId);
    if (!role) return false;

    return hasPermission(role, permission);
  };

  const checkRole = async (requiredRole: Role): Promise<boolean> => {
    const orgId = getOrgId();
    if (!orgId) return false;

    const role = await getCurrentUserRole(orgId);
    if (!role) return false;

    return hasRole(role, requiredRole);
  };

  return { checkPermission, checkRole };
}

export async function requirePermission(
  permission: keyof typeof PERMISSIONS
): Promise<boolean> {
  const orgId = getOrgId();
  if (!orgId) return false;

  const role = await getCurrentUserRole(orgId);
  if (!role) return false;

  return hasPermission(role, permission);
}

export class PermissionError extends Error {
  constructor(
    message: string,
    public requiredRole: Role,
    public userRole: Role | null
  ) {
    super(message);
    this.name = "PermissionError";
  }
}

export function checkPermissionOrThrow(
  role: Role | null,
  permission: keyof typeof PERMISSIONS
): void {
  if (!role || !hasPermission(role, permission)) {
    const requiredPerms = PERMISSIONS[permission];
    const requiredRole =
      requiredPerms.length > 0
        ? requiredPerms[requiredPerms.length - 1]
        : "owner";
    throw new PermissionError(
      `Permission denied. Required role: ${requiredRole}`,
      requiredRole as Role,
      role
    );
  }
}
