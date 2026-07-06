import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAccessControl } from "@/lib/access";

export function RequireSuperAdmin() {
  const location = useLocation();
  const { user, isSuperAdmin, loadingAccess, accessError } = useAccessControl();

  if (loadingAccess) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
        Verificando permissões…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (accessError || !isSuperAdmin) {
    return <Navigate to="/app/hoje" replace />;
  }

  return <Outlet />;
}
