import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAccess } from "@/lib/access";
import { useAuth } from "@/lib/auth";

/**
 * Guarda a área /superadmin. Não renderiza filhos antes da checagem concluir,
 * para evitar flash da UI protegida. Redireciona não-superadmins autenticados
 * para /app/hoje; visitantes não autenticados para /auth.
 */
export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { isSuperAdmin, loadingAccess } = useAccess();
  const location = useLocation();

  if (loading || loadingAccess) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-muted-foreground">
        Verificando permissões…
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;
  if (!isSuperAdmin) return <Navigate to="/app/hoje" replace />;
  return <>{children}</>;
}

/**
 * Redireciona rotas legadas técnicas: superadmin vai para a rota equivalente
 * em /superadmin; demais usuários vão para /app/hoje.
 */
export function LegacyTechRedirect({ superadminTo }: { superadminTo: string }) {
  const { user, loading } = useAuth();
  const { isSuperAdmin, loadingAccess } = useAccess();
  if (loading || loadingAccess) {
    return <div className="min-h-dvh flex items-center justify-center text-muted-foreground">Redirecionando…</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <Navigate to={isSuperAdmin ? superadminTo : "/app/hoje"} replace />;
}