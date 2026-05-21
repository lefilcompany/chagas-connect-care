import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Profile() {
  const { user } = useAuth();
  const [data, setData] = useState({ full_name: "", role_label: "", institution: "", professional_registry: "" });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data: p }) => {
      if (p) setData({ full_name: p.full_name ?? "", role_label: p.role_label ?? "", institution: p.institution ?? "", professional_registry: p.professional_registry ?? "" });
    });
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("profiles").update(data).eq("id", user!.id);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
  };

  return (
    <div className="space-y-6 max-w-xl">
      <header>
        <h1 className="font-display text-3xl font-bold text-brand">Perfil</h1>
        <p className="text-muted-foreground mt-1">Mantenha seus dados profissionais atualizados.</p>
      </header>
      <form onSubmit={save} className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
        <div className="space-y-2"><Label>Nome completo</Label><Input value={data.full_name} onChange={(e) => setData({ ...data, full_name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Função</Label><Input value={data.role_label} onChange={(e) => setData({ ...data, role_label: e.target.value })} /></div>
          <div className="space-y-2"><Label>CRM/COREN</Label><Input value={data.professional_registry} onChange={(e) => setData({ ...data, professional_registry: e.target.value })} /></div>
        </div>
        <div className="space-y-2"><Label>Instituição</Label><Input value={data.institution} onChange={(e) => setData({ ...data, institution: e.target.value })} /></div>
        <div className="space-y-2"><Label>E-mail</Label><Input value={user?.email ?? ""} disabled /></div>
        <Button type="submit" variant="hero">Salvar</Button>
      </form>
    </div>
  );
}