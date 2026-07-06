import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useInstitutionScope } from "@/components/superadmin/InstitutionScope";

export default function AuditLog() {
  const { selected, isAll } = useInstitutionScope();
  const { data } = useQuery({
    queryKey: ["sa-audit", selected],
    staleTime: 30_000,
    queryFn: async () => {
      const q = supabase.from("whatsapp_admin_audit_log")
        .select("*").order("created_at", { ascending: false }).limit(200);
      const { data } = isAll ? await q : await q.eq("institution", selected);
      return (data ?? []) as Array<Record<string, unknown>>;
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">Auditoria</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Últimas 200 ações administrativas registradas.
        </p>
      </header>
      <Card>
        <CardHeader><CardTitle className="text-base">{data?.length ?? 0} eventos</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-left uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Quando</th>
                <th className="px-3 py-2">Ação</th>
                <th className="px-3 py-2">Instituição</th>
                <th className="px-3 py-2">Entidade</th>
                <th className="px-3 py-2">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((r, i) => (
                <tr key={String(r.id ?? i)} className="border-t border-border">
                  <td className="px-3 py-2">{r.created_at ? new Date(String(r.created_at)).toLocaleString("pt-BR") : "—"}</td>
                  <td className="px-3 py-2 font-medium text-ink">{String(r.action ?? "—")}</td>
                  <td className="px-3 py-2">{String(r.institution ?? "—")}</td>
                  <td className="px-3 py-2">{String(r.entity ?? "—")}{r.entity_id ? ` · ${String(r.entity_id).slice(0, 8)}` : ""}</td>
                  <td className="px-3 py-2">{String(r.result ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}