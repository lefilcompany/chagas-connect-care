import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plug, RefreshCw } from "lucide-react";

const CRMS = [
  { id: "hubspot", name: "HubSpot", desc: "CRM para vendas, marketing e atendimento." },
  { id: "salesforce", name: "Salesforce", desc: "Plataforma CRM enterprise." },
  { id: "pipedrive", name: "Pipedrive", desc: "CRM focado em pipeline comercial." },
];

export default function Integrations() {
  const [logs, setLogs] = useState<any[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);

  const load = () => supabase.from("crm_sync_log").select("*").order("created_at", { ascending: false }).limit(20).then(({ data }) => setLogs(data ?? []));
  useEffect(() => { load(); }, []);

  const sync = async (crm: string) => {
    setSyncing(crm);
    const { data: patients } = await supabase.from("patients").select("id, full_name, phone, stage");
    const { error } = await supabase.from("crm_sync_log").insert({
      crm_name: crm, status: "success",
      payload: { synced: patients?.length ?? 0, sample: patients?.slice(0, 3) ?? [] },
    } as any);
    setSyncing(null);
    if (error) return toast.error(error.message);
    toast.success(`${patients?.length ?? 0} pacientes sincronizados com ${crm} (mock)`);
    load();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold text-brand">Integrações</h1>
        <p className="text-muted-foreground mt-1">Conecte sua plataforma de CRM e mantenha os dados sincronizados.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {CRMS.map((c) => (
          <div key={c.id} className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/50 text-brand flex items-center justify-center"><Plug className="h-5 w-5" /></div>
              <h3 className="font-display text-lg font-bold text-brand">{c.name}</h3>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{c.desc}</p>
            <Button className="mt-4 w-full" variant="outlineBrand" onClick={() => sync(c.id)} disabled={syncing === c.id}>
              <RefreshCw className={`h-4 w-4 ${syncing === c.id ? "animate-spin" : ""}`} />
              {syncing === c.id ? "Sincronizando..." : "Sincronizar agora"}
            </Button>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border font-semibold text-brand">Histórico de sincronização</div>
        {logs.length === 0 ? <div className="p-8 text-center text-muted-foreground">Nenhuma sincronização ainda.</div> : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-4">Quando</th><th className="p-4">CRM</th><th className="p-4">Status</th><th className="p-4">Pacientes</th></tr></thead>
            <tbody>{logs.map((l) => (
              <tr key={l.id} className="border-t border-border"><td className="p-4">{new Date(l.created_at).toLocaleString("pt-BR")}</td><td className="p-4 capitalize">{l.crm_name}</td><td className="p-4">{l.status}</td><td className="p-4">{(l.payload as any)?.synced ?? 0}</td></tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}