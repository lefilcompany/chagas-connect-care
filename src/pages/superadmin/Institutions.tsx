import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Building2, Search, UsersRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdminScope } from "@/lib/superadmin-context";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Institutions() {
  const navigate = useNavigate();
  const { setSelectedInstitution } = useSuperAdminScope();
  const [search, setSearch] = useState("");

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["superadmin-institution-directory"],
    queryFn: async () => {
      const [profiles, channels] = await Promise.all([
        supabase.from("profiles").select("id,institution").neq("institution", ""),
        supabase.from("whatsapp_channels").select("id,institution,status,last_webhook_at"),
      ]);
      if (profiles.error) throw profiles.error;
      if (channels.error) throw channels.error;

      const grouped = new Map<string, {
        institution: string;
        members: number;
        channels: number;
        activeChannels: number;
        lastWebhook: string | null;
      }>();

      for (const profile of profiles.data ?? []) {
        const institution = profile.institution?.trim();
        if (!institution) continue;
        const current = grouped.get(institution) ?? {
          institution,
          members: 0,
          channels: 0,
          activeChannels: 0,
          lastWebhook: null,
        };
        current.members += 1;
        grouped.set(institution, current);
      }

      for (const channel of channels.data ?? []) {
        const institution = channel.institution?.trim();
        if (!institution) continue;
        const current = grouped.get(institution) ?? {
          institution,
          members: 0,
          channels: 0,
          activeChannels: 0,
          lastWebhook: null,
        };
        current.channels += 1;
        if (["active", "connected"].includes(channel.status)) current.activeChannels += 1;
        if (channel.last_webhook_at && (!current.lastWebhook || channel.last_webhook_at > current.lastWebhook)) {
          current.lastWebhook = channel.last_webhook_at;
        }
        grouped.set(institution, current);
      }

      return Array.from(grouped.values()).sort((a, b) => a.institution.localeCompare(b.institution, "pt-BR"));
    },
  });

  const filtered = useMemo(() => {
    const value = search.trim().toLocaleLowerCase("pt-BR");
    if (!value) return data;
    return data.filter((item) => item.institution.toLocaleLowerCase("pt-BR").includes(value));
  }, [data, search]);

  const openInstitution = (institution: string) => {
    setSelectedInstitution(institution);
    navigate("/superadmin/canais");
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-care">Escopo global</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-ink">Instituições</h1>
        <p className="mt-2 text-sm text-muted-foreground">Selecione uma instituição para administrar seus canais e configurações técnicas.</p>
      </header>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border p-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar instituição" className="pl-9" />
          </div>
          <span className="ml-auto text-sm text-muted-foreground">{filtered.length} instituição(ões)</span>
        </div>

        {error ? (
          <p className="p-6 text-sm text-destructive">Não foi possível carregar as instituições.</p>
        ) : isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando instituições…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhuma instituição encontrada.</p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((item) => (
              <div key={item.institution} className="flex flex-wrap items-center gap-4 p-4 hover:bg-muted/20">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint-soft text-care">
                  <Building2 className="h-5 w-5" />
                </span>
                <div className="min-w-[220px] flex-1">
                  <p className="font-semibold text-ink">{item.institution}</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><UsersRound className="h-3.5 w-3.5" /> {item.members} membro(s)</span>
                    <span>{item.activeChannels}/{item.channels} canal(is) ativo(s)</span>
                    <span>Último webhook: {item.lastWebhook ? new Date(item.lastWebhook).toLocaleString("pt-BR") : "sem eventos"}</span>
                  </div>
                </div>
                <Button variant="outline" onClick={() => openInstitution(item.institution)}>Administrar</Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
