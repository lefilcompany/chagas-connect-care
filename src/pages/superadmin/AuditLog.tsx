import { useQuery } from "@tanstack/react-query";
import { FileClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdminScope } from "@/lib/superadmin-context";
import { Card } from "@/components/ui/card";

export default function AuditLog() {
  const { selectedInstitution } = useSuperAdminScope();
  const audit = useQuery({
    queryKey: ["superadmin-audit-log", selectedInstitution],
    queryFn: async () => {
      const base = supabase.from("whatsapp_admin_audit_log")
        .select("id,actor_role,institution,entity,action,result,error_code,correlation_id,created_at")
        .order("created_at", { ascending: false }).limit(200);
      const { data, error } = selectedInstitution ? await base.eq("institution", selectedInstitution) : await base;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <header><p className="text-xs font-bold uppercase tracking-[0.16em] text-care">Segurança</p><h1 className="mt-1 font-display text-3xl font-bold text-ink">Auditoria administrativa</h1><p className="mt-2 text-sm text-muted-foreground">Histórico das operações técnicas no escopo selecionado.</p></header>
      <Card className="divide-y divide-border overflow-hidden">
        {audit.isLoading ? <p className="p-6 text-sm text-muted-foreground">Carregando auditoria…</p> : audit.error ? <p className="p-6 text-sm text-destructive">Não foi possível carregar o histórico.</p> : !audit.data?.length ? <div className="p-8 text-center"><FileClock className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium text-ink">Nenhuma ação registrada</p></div> : audit.data.map((item) => (
          <div key={item.id} className="grid gap-2 p-4 text-sm md:grid-cols-[180px_1fr_180px]">
            <div><p className="font-medium text-ink">{item.action}</p><p className="text-xs text-muted-foreground">{item.entity} · {item.actor_role || "—"}</p></div>
            <div><p className="text-ink">{item.institution || "Escopo global"}</p><p className="truncate font-mono text-xs text-muted-foreground">{item.correlation_id || "Sem correlação"}</p></div>
            <div className="md:text-right"><p className="font-medium text-muted-foreground">{item.result || "—"}</p><p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("pt-BR")}</p>{item.error_code && <p className="text-xs text-destructive">{item.error_code}</p>}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}
