import { Outlet, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShieldCheck, LogOut } from "lucide-react";
import { SuperadminRoute } from "./SuperadminRoute";

function Shell() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/superadmin/whatsapp" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Central Superadmin</div>
              <div className="text-[11px] text-slate-400">Administração global</div>
            </div>
          </Link>
          <Button
            size="sm"
            variant="outline"
            className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-slate-100"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/superadmin/login", { replace: true });
            }}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-background text-foreground rounded-lg p-6 border border-slate-800/40">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default function SuperadminLayout() {
  return (
    <SuperadminRoute>
      <Shell />
    </SuperadminRoute>
  );
}