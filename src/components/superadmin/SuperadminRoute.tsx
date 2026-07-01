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
    return <div className="p-8 text-sm text-muted-foreground">Verificando permissões…</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isSuper) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-2">
        <h1 className="text-lg font-semibold">Acesso negado</h1>
        <p className="text-sm text-muted-foreground">
          Esta área é restrita a superadministradores.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}