import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchAllAppRoutes } from "@/lib/queries";
import { Menu } from "lucide-react";
import { AppSidebar } from "./shell/AppSidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const AppLayout = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [profileName, setProfileName] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => { if (!loading && !user) navigate("/auth"); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle().then(({ data }) => {
      setProfileName((data?.full_name as string) || user.email || "");
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const id = window.setTimeout(() => prefetchAllAppRoutes(queryClient), 150);
    return () => window.clearTimeout(id);
  }, [user, queryClient]);

  if (loading || !user) {
    return <div className="min-h-dvh flex items-center justify-center text-muted-foreground">Carregando…</div>;
  }

  const askSignOut = () => setLogoutOpen(true);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <div className="hidden h-dvh shrink-0 lg:block">
        <AppSidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          profileName={profileName}
          email={user.email ?? ""}
          onSignOut={askSignOut}
        />
      </div>

      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden animate-slide-in-down">
            <AppSidebar
              collapsed={false}
              onToggleCollapse={() => undefined}
              onCloseMobile={() => setDrawerOpen(false)}
              profileName={profileName}
              email={user.email ?? ""}
              onSignOut={askSignOut}
            />
          </div>
        </>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center border-b border-border bg-card px-4 lg:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menu"
            className="tap-target rounded-lg text-ink"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="ml-3 font-display text-base font-bold text-ink">Chagas Connect Care</span>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full w-full" type="hover" scrollHideDelay={400}>
            <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8 md:py-8 xl:px-10">
              <Outlet />
            </div>
          </ScrollArea>
        </main>
      </div>

      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar saída</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja sair da sua conta?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { await signOut(); navigate("/"); }}>Sair</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
