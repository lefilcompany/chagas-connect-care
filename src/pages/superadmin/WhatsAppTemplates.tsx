import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useInstitutionScope } from "@/components/superadmin/InstitutionScope";

export default function WhatsAppTemplates() {
  const qc = useQueryClient();
  const { selected, isAll } = useInstitutionScope();

  const { data } = useQuery({
    queryKey: ["sa-templates", selected],
    staleTime: 60_000,
    queryFn: async () => {
      const q = supabase.from("message_templates")
        .select("id,meta_template_name,meta_language,meta_status,institution,updated_at")
        .eq("template_kind", "meta")
        .order("updated_at", { ascending: false })
        .limit(200);
      const { data } = isAll ? await q : await q.eq("institution", selected);
      return (data ?? []) as Array<{ id: string; meta_template_name: string | null; meta_language: string | null; meta_status: string | null; institution: string | null; updated_at: string | null }>;
    },
  });

  const sync = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-whatsapp-templates", {
        body: isAll ? {} : { institution: selected },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Sincronização concluída" });
      qc.invalidateQueries({ queryKey: ["sa-templates"] });
    },
    onError: (e: Error) => toast({ title: "Falha ao sincronizar", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">Templates e sincronização</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAll ? "Todos os templates de todas as instituições." : `Templates da instituição “${selected}”.`}
          </p>
        </div>
        <Button onClick={() => sync.mutate()} disabled={sync.isPending || isAll}>
          {sync.isPending ? "Sincronizando…" : "Sincronizar com a Meta"}
        </Button>
      </header>
      {isAll && (
        <p className="text-xs text-amber-700">Selecione uma instituição no topo para sincronizar.</p>
      )}
      <Card>
        <CardHeader><CardTitle className="text-base">{data?.length ?? 0} templates</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Nome</th>
                <th className="px-4 py-2">Idioma</th>
                <th className="px-4 py-2">Instituição</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-4 py-2 font-medium text-ink">{t.meta_template_name ?? "—"}</td>
                  <td className="px-4 py-2">{t.meta_language ?? "—"}</td>
                  <td className="px-4 py-2">{t.institution ?? "—"}</td>
                  <td className="px-4 py-2">{t.meta_status ?? "—"}</td>
                  <td className="px-4 py-2">{t.updated_at ? new Date(t.updated_at).toLocaleString("pt-BR") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}