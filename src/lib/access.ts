import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "equipe" | "superadmin";

export type AccessFlags = {
  isSuperAdmin: boolean;
  isInstitutionAdmin: boolean;
  isTeamMember: boolean;
};

export function resolveAccessFlags(roles: readonly AppRole[]): AccessFlags {
  const roleSet = new Set(roles);
  return {
    isSuperAdmin: roleSet.has("superadmin"),
    isInstitutionAdmin: roleSet.has("admin"),
    isTeamMember: roleSet.has("equipe"),
  };
}

export function useAccessControl() {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ["current-user-access", user?.id],
    queryFn: async () => {
      if (!user) {
        return {
          fullName: "",
          institution: null as string | null,
          roles: [] as AppRole[],
        };
      }

      const [profileResult, rolesResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, institution")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (rolesResult.error) throw rolesResult.error;

      const roles = Array.from(
        new Set((rolesResult.data ?? []).map((row) => row.role as AppRole)),
      );

      return {
        fullName: profileResult.data?.full_name ?? user.email ?? "",
        institution: profileResult.data?.institution || null,
        roles,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const roles = query.data?.roles ?? [];
  const flags = resolveAccessFlags(roles);

  return {
    user,
    fullName: query.data?.fullName ?? "",
    institution: query.data?.institution ?? null,
    roles,
    ...flags,
    loadingAccess: authLoading || (!!user && query.isLoading),
    accessError: query.error,
    refetchAccess: query.refetch,
  };
}
