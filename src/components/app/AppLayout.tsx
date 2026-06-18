import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchAllAppRoutes, prefetchRoute } from "@/lib/queries";
import {
  Heart, LayoutDashboard, Users, MessageCircle, BookOpen, BarChart3,
  UserCircle, LogOut, Menu, X, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const nav = [
  { to: "/app", end: true, label: "Painel", icon: LayoutDashboard },
  { to: "/app/pacientes", label: "Pacientes", icon: Users },
  { to: "/app/mensagens", label: "Mensagens", icon: MessageCircle },
  { to: "/app/conteudos", label: "Conteúdos", icon: BookOpen },
  { to: "/app/segmentos", label: "Segmentos", icon: Target },
  { to: "/app/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/app/perfil", label: "Perfil", icon: UserCircle },
];

export const AppLayout = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [profileName, setProfileName] = useState<string>("");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    setProfileLoaded(false);
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle().then(({ data }) => {
      setProfileName((data?.full_name as string) || user.email || "");
      setProfileLoaded(true);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // Warm all main screens after first render so navigation is instant.
    const id = window.setTimeout(() => prefetchAllAppRoutes(queryClient), 150);
    return () => window.clearTimeout(id);
  }, [user, queryClient]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-muted/40 flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border flex flex-col transition-transform lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-border">
          <NavLink to="/app" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
              <Heart className="h-4 w-4" fill="currentColor" />
            </span>
            <span className="font-display font-bold text-brand">Cuidado Digital</span>
          </NavLink>
          <button className="lg:hidden" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={() => setOpen(false)}
              onMouseEnter={() => prefetchRoute(queryClient, n.to)}
              onFocus={() => prefetchRoute(queryClient, n.to)}
              onTouchStart={() => prefetchRoute(queryClient, n.to)}
              className={({ isActive }) => cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-primary text-brand" : "text-foreground/70 hover:bg-muted hover:text-brand",
              )}
            >
              <n.icon className="h-4 w-4" />{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <div className="px-2 py-2 text-xs">
            {profileLoaded ? (
              <>
                <div className="font-semibold text-brand truncate">{profileName}</div>
                <div className="text-muted-foreground truncate">{user.email}</div>
              </>
            ) : (
              <div className="space-y-1.5 py-0.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
            )}
          </div>
          <Button variant="ghost" className="w-full justify-start text-foreground/70" onClick={() => setLogoutOpen(true)}>
            <LogOut className="h-4 w-4" /> Sair
          </Button>

          <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar saída</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja sair da sua conta?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={async () => { await signOut(); navigate("/"); }}>
                  Sair
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </aside>

      {/* Main */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center px-4 md:px-8 lg:hidden">
          <button onClick={() => setOpen(true)}><Menu className="h-6 w-6 text-brand" /></button>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};