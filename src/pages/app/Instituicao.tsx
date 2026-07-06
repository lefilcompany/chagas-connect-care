import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Users, ShieldCheck, Save } from "lucide-react";

export default function Instituicao() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["me-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles").select("institution").eq("id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", {
        _user_id: user!.id, _role: "admin",
      });
      return !!data;
    },
    enabled: !!user,
  });

  const institution = me?.institution ?? "";

  useEffect(() => { setName(institution); }, [institution]);

  const { data: stats } = useQuery({
    queryKey: ["institution-stats", institution],
    queryFn: async () => {
      const [{ count: members }, { data: admins }] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true })
          .eq("institution", institution),
        supabase.from("profiles").select("id, full_name")
          .eq("institution", institution),
      ]);
      const ids = (admins ?? []).map((a) => a.id);
      let adminNames: string[] = [];
      if (ids.length) {
        const { data: rls } = await supabase
          .from("user_roles").select("user_id").eq("role", "admin").in("user_id", ids);
        const adminIds = new Set((rls ?? []).map((r) => r.user_id));
        adminNames = (admins ?? [])
          .filter((a) => adminIds.has(a.id))
          .map((a) => a.full_name || "Sem nome");
      }
      return { members: members ?? 0, adminNames };
    },
    enabled: !!institution,
  });

  const saveName = async () => {
    if (!name.trim() || name === institution) return;
    setSaving(true);
    // Bulk rename institution across all profiles in the same institution.
    const { error } = await supabase
      .from("profiles").update({ institution: name.trim() }).eq("institution", institution);
    setSaving(false);
    if (error) return toast.error(error.message);
    await queryClient.invalidateQueries();
    toast.success("Instituição atualizada");
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold text-brand">Instituição</h1>
        <p className="text-muted-foreground mt-1">
          Informações da organização que aparecem em mensagens, modelos e relatórios.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-border bg-card shadow-card">
          <div className="flex items-start gap-3 p-6 border-b border-border">
            <div className="h-10 w-10 rounded-xl bg-primary/60 flex items-center justify-center text-brand">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-brand">Dados da instituição</h2>
              <p className="text-sm text-muted-foreground">
                Nome exibido para pacientes e equipe.
              </p>
            </div>
          </div>
          <div className="p-6 space-y-5 max-w-lg">
            <div className="space-y-2">
              <Label htmlFor="institution-name" className="text-xs uppercase tracking-wide text-muted-foreground">
                Nome da instituição
              </Label>
              <Input
                id="institution-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isAdmin}
                placeholder="Ex: Clínica Chagas Care"
              />
              {!isAdmin && (
                <p className="text-xs text-muted-foreground">
                  Somente administradores podem editar o nome da instituição.
                </p>
              )}
            </div>
            {isAdmin && (
              <Button
                variant="hero"
                onClick={saveName}
                disabled={saving || !name.trim() || name === institution}
              >
                <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar alterações"}
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              <Users className="h-4 w-4" /> Membros
            </div>
            <div className="mt-2 font-display text-3xl font-bold text-brand">
              {stats?.members ?? "—"}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              <ShieldCheck className="h-4 w-4" /> Administradores
            </div>
            <div className="mt-2 space-y-1">
              {(stats?.adminNames ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum administrador definido.</p>
              ) : (
                (stats?.adminNames ?? []).map((n) => (
                  <div key={n} className="text-sm font-semibold text-brand truncate">{n}</div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
