import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

/**
 * Bloqueia qualquer rota que não seja acessada por um usuário com o papel
 * `superadmin`. A validação real acontece no backend (RLS + is_superadmin);
 * este componente apenas evita renderizar UI para quem não deve ver.
 */
export function SuperadminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  const { data: isSuper, isLoading } = useQuery({
    queryKey: ["is_superadmin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "superadmin")
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
    staleTime: 60_000,
  });

  if (loading || (user && isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300 text-sm">
        Verificando permissões…
      </div>
    );
  }
  if (!user || !isSuper) return <Navigate to="/superadmin/login" replace />;
  return <>{children}</>;
}