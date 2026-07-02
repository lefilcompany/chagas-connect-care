import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  InstitutionIdentityContext,
  type InstitutionIdentity,
} from "./institutionTemplates";

/**
 * Provides the InstitutionIdentity for the current authenticated user by
 * reading `profiles.institution` and `user_roles`. Kept separate from the
 * service module so tests can import the context/hook without pulling
 * Supabase or React Query into the mock graph.
 */
export function InstitutionIdentityProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const query = useQuery({
    queryKey: ["institution-identity", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [profile, roles] = await Promise.all([
        supabase.from("profiles").select("institution").eq("id", user!.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
      ]);
      const institution = ((profile.data as { institution?: string } | null)?.institution) || null;
      const roleList = (roles.data ?? []).map((r: { role: string }) => r.role);
      const isAdmin = roleList.includes("admin") || roleList.includes("superadmin");
      return { institution, isAdmin };
    },
  });

  const identity: InstitutionIdentity = {
    institution: query.data?.institution ?? null,
    isAdmin: query.data?.isAdmin ?? false,
    loading: authLoading || (!!user && query.isLoading),
    error: (query.error as Error) ?? null,
  };

  return (
    <InstitutionIdentityContext.Provider value={identity}>
      {children}
    </InstitutionIdentityContext.Provider>
  );
}