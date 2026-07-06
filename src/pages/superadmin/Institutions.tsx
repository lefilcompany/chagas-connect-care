import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Institutions() {
  const { data } = useQuery({
    queryKey: ["sa-institutions"],
    staleTime: 60_000,
    queryFn: async () => {
      const [{ data: profs }, { data: chans }] = await Promise.all([
        supabase.from("profiles").select("institution"),
        supabase.from("whatsapp_channels").select("institution,status"),
      ]);
      const map = new Map<string, { members: number; channels: number; active: number }>();
      for (const p of (profs ?? []) as Array<{ institution: string | null }>) {
        const k = (p.institution ?? "").trim();
        if (!k) continue;
        const cur = map.get(k) ?? { members: 0, channels: 0, active: 0 };
        cur.members++; map.set(k, cur);
      }
      for (const c of (chans ?? []) as Array<{ institution: string | null; status: string | null }>) {
        const k = (c.institution ?? "").trim();
        if (!k) continue;
        const cur = map.get(k) ?? { members: 0, channels: 0, active: 0 };
        cur.channels++;
        if (c.status === "active") cur.active++;
        map.set(k, cur);
      }
      return Array.from(map.entries())
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">Instituições</h1>
        <p className="mt-1 text-sm text-muted-foreground">Todas as instituições cadastradas na plataforma.</p>
      </header>
      <Card>
        <CardHeader><CardTitle className="text-base">{data?.length ?? 0} instituições</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Instituição</th>
                <th className="px-4 py-2">Membros</th>
                <th className="px-4 py-2">Canais</th>
                <th className="px-4 py-2">Ativos</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((i) => (
                <tr key={i.name} className="border-t border-border">
                  <td className="px-4 py-2 font-medium text-ink">{i.name}</td>
                  <td className="px-4 py-2">{i.members}</td>
                  <td className="px-4 py-2">{i.channels}</td>
                  <td className="px-4 py-2">{i.active}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}