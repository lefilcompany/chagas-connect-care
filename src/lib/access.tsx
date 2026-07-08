import { createContext, useContext, ReactNode, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getE2EMockContext } from "@/lib/e2e";

export type AppRole = "superadmin" | "admin" | "equipe";

export type CurrentUserAccess = {
  userId: string | null;
  email: string | null;
  institution: string | null;
  roles: AppRole[];
  isSuperAdmin: boolean;
  isInstitutionAdmin: boolean;
  isTeamMember: boolean;
  loadingAccess: boolean;
};

const Ctx = createContext<CurrentUserAccess>({
  userId: null,
  email: null,
  institution: null,
  roles: [],
  isSuperAdmin: false,
  isInstitutionAdmin: false,
  isTeamMember: false,
  loadingAccess: true,
});

export function AccessProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const e2e = getE2EMockContext();

  const { data, isLoading } = useQuery({
    queryKey: ["current-user-access", user?.id],
    enabled: !!user?.id && !e2e.enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!user?.id) return { roles: [] as AppRole[], institution: null as string | null };
      const [rolesRes, profRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("institution").eq("id", user.id).maybeSingle(),
      ]);
      const roles = ((rolesRes.data ?? []) as Array<{ role: AppRole }>).map((r) => r.role);
      const institution = (profRes.data as { institution?: string } | null)?.institution ?? null;
      return { roles, institution };
    },
  });

  const value = useMemo<CurrentUserAccess>(() => {
    const roles: AppRole[] = e2e.enabled && user ? [e2e.role] : data?.roles ?? [];
    const institution = e2e.enabled && user ? e2e.institution : data?.institution ?? null;
    return {
      userId: user?.id ?? null,
      email: user?.email ?? null,
      institution,
      roles,
      isSuperAdmin: roles.includes("superadmin"),
      isInstitutionAdmin: roles.includes("admin"),
      isTeamMember: roles.includes("equipe"),
      loadingAccess: e2e.enabled ? false : loading || (!!user && isLoading),
    };
  }, [user, loading, data, isLoading, e2e.enabled, e2e.role, e2e.institution]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccess() {
  return useContext(Ctx);
}
