import { useState } from "react";
import { Menu } from "lucide-react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useAccessControl } from "@/lib/access";
import { SuperAdminScopeProvider } from "@/lib/superadmin-context";
import { SuperAdminSidebar } from "@/components/superadmin/SuperAdminSidebar";
import { ScrollArea } from "@/components/ui/scroll-area";

function SuperAdminShell() {
  const { user, signOut } = useAuth();
  const { fullName } = useAccessControl();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-muted/20">
      <div className="hidden h-dvh shrink-0 lg:block">
        <SuperAdminSidebar
          email={user?.email ?? ""}
          fullName={fullName}
          onSignOut={handleSignOut}
        />
      </div>

      {drawerOpen && (
        <>
          <button
            className="fixed inset-0 z-40 bg-ink/50 lg:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-label="Fechar menu"
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <SuperAdminSidebar
              email={user?.email ?? ""}
              fullName={fullName}
              onSignOut={handleSignOut}
              onCloseMobile={() => setDrawerOpen(false)}
            />
          </div>
        </>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center border-b border-border bg-card px-4 lg:hidden">
          <button onClick={() => setDrawerOpen(true)} className="rounded-lg p-2 text-ink" aria-label="Abrir menu do Super Admin">
            <Menu className="h-6 w-6" />
          </button>
          <div className="ml-3">
            <p className="text-sm font-bold text-ink">Super Admin</p>
            <p className="text-[11px] text-muted-foreground">Infraestrutura global</p>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full w-full" type="hover" scrollHideDelay={400}>
            <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8 md:py-8 xl:px-10">
              <Outlet />
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}

export function SuperAdminLayout() {
  return (
    <SuperAdminScopeProvider>
      <SuperAdminShell />
    </SuperAdminScopeProvider>
  );
}
