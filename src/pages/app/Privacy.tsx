import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ListChecks, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AuditEventItem, type AuditRow } from "@/features/privacy/AuditEventItem";
import { ConsentStatus, type ConsentValue } from "@/features/privacy/ConsentStatus";
import { PrivacyCheck } from "@/features/privacy/PrivacyCheck";
import { MessageSafetyPreview, messageHasClinicalContent } from "@/features/privacy/MessageSafetyPreview";
import { EmptyState } from "@/components/care/EmptyState";

function useIsAdmin() {
  const { user } = useAuth();
  return useQuery<boolean>({
    queryKey: ["is-admin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", { _user_id: user!.id, _role: "admin" });
      if (error) return false;
      return !!data;
    },
  });
}

function useConsentOverview() {
  return useQuery({
    queryKey: ["privacy-consent-overview"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("authorization_status").limit(2000);
      if (error) throw error;
      const counts = { authorized: 0, pending: 0, revoked: 0, unknown: 0 };
      for (const c of data ?? []) {
        const raw = (c.authorization_status ?? "").toLowerCase();
        if (raw === "authorized" || raw === "ativo" || raw === "granted") counts.authorized++;
        else if (raw === "revoked" || raw === "revogado") counts.revoked++;
        else if (raw === "pending" || raw === "pendente") counts.pending++;
        else counts.unknown++;
      }
      return { total: (data ?? []).length, counts };
    },
    staleTime: 60_000,
  });
}

function useAuditLog() {
  return useQuery<AuditRow[]>({
    queryKey: ["privacy-audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_admin_audit_log")
        .select("id, created_at, actor_role, entity, entity_id, action, result, error_code, correlation_id")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });
}

export default function Privacy() {
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { data: consent, isLoading: consentLoading } = useConsentOverview();
  const { data: audit = [], isLoading: auditLoading } = useAuditLog();

  const [demoBody, setDemoBody] = useState(
    "Olá {{nome}}, seu resultado do exame de Chagas está disponível. Traga seu CPF na próxima consulta.",
  );
  const [demoConsent, setDemoConsent] = useState<ConsentValue>("authorized");
  const [demoPhone, setDemoPhone] = useState("+5511999999999");
  const [demoRelation, setDemoRelation] = useState("familiar");

  const clinical = useMemo(() => messageHasClinicalContent(demoBody), [demoBody]);

  if (adminLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Verificando permissões…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Acesso restrito"
        description="Esta área é visível apenas para administradores da instituição. Fale com quem administra sua conta para receber acesso."
      />
    );
  }

  const total = consent?.total ?? 0;
  const c = consent?.counts ?? { authorized: 0, pending: 0, revoked: 0, unknown: 0 };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">Privacidade e auditoria</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Painel de conformidade: distribuição de consentimentos da rede de cuidado, trilha de
          eventos administrativos e simulador de verificação antes do envio.
        </p>
      </header>

      <section aria-labelledby="consent-overview" className="space-y-3">
        <h2 id="consent-overview" className="font-display text-lg font-semibold text-ink">Consentimento na rede</h2>
        {consentLoading ? (
          <div className="grid gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-secondary" />)}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-4">
            {([
              { key: "authorized", label: "Ativo", value: c.authorized, tone: "text-care" },
              { key: "pending",    label: "Pendente", value: c.pending, tone: "text-primary" },
              { key: "revoked",    label: "Revogado", value: c.revoked, tone: "text-destructive" },
              { key: "unknown",    label: "Não registrado", value: c.unknown, tone: "text-muted-foreground" },
            ] as const).map((m) => (
              <Card key={m.key} className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</p>
                <p className={`mt-1 font-display text-2xl font-semibold ${m.tone}`}>{m.value}</p>
                <p className="text-[11px] text-muted-foreground">
                  {total > 0 ? `${Math.round((m.value / total) * 100)}% da rede` : "sem dados"}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="privacy-simulator" className="space-y-3">
        <h2 id="privacy-simulator" className="font-display text-lg font-semibold text-ink">Simulador de envio seguro</h2>
        <Card className="grid gap-6 p-5 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="demo-body">Mensagem</Label>
              <Textarea id="demo-body" rows={6} value={demoBody} onChange={(e) => setDemoBody(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="demo-consent">Consentimento</Label>
                <Select value={demoConsent} onValueChange={(v) => setDemoConsent(v as ConsentValue)}>
                  <SelectTrigger id="demo-consent"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="authorized">Ativo</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="revoked">Revogado</SelectItem>
                    <SelectItem value="unknown">Não registrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="demo-phone">Telefone</Label>
                <Input id="demo-phone" value={demoPhone} onChange={(e) => setDemoPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="demo-relation">Relação</Label>
                <Select value={demoRelation} onValueChange={setDemoRelation}>
                  <SelectTrigger id="demo-relation"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paciente">Paciente</SelectItem>
                    <SelectItem value="familiar">Familiar</SelectItem>
                    <SelectItem value="cuidador">Cuidador</SelectItem>
                    <SelectItem value="medico">Médico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status atual:</span>
              <ConsentStatus value={demoConsent} />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prévia de segurança</p>
              <MessageSafetyPreview body={demoBody} />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Verificação de privacidade</p>
              <PrivacyCheck
                consent={demoConsent}
                phone={demoPhone}
                channel="whatsapp"
                relation={demoRelation}
                hasClinicalContent={clinical}
              />
            </div>
            <div className="flex justify-end">
              <Button disabled variant="outline">Enviar (simulação)</Button>
            </div>
          </div>
        </Card>
      </section>

      <section aria-labelledby="audit-log" className="space-y-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 id="audit-log" className="font-display text-lg font-semibold text-ink">Trilha de auditoria</h2>
        </div>
        <Card className="p-5">
          {auditLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-secondary" />)}
            </div>
          ) : audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há eventos administrativos registrados.</p>
          ) : (
            <ul>
              {audit.map((row) => <AuditEventItem key={row.id} row={row} />)}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}