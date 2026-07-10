import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

// Beta helpers on supabase.auth.oauth — typed locally so TS is happy.
type OAuthClient = { name?: string; client_uri?: string; logo_uri?: string };
type AuthorizationDetails = {
  client?: OAuthClient;
  scope?: string;
  redirect_uri?: string;
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

const SCOPE_LABELS: Record<string, string> = {
  openid: "Identificar você no Chagas Digital Care",
  email: "Ver seu e-mail",
  profile: "Ver seu nome e informações básicas de perfil",
};

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Parâmetro authorization_id ausente na URL.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error: err } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (err) {
        setError(err.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error: err } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou uma URL de redirecionamento.");
      return;
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-card space-y-3">
          <h1 className="font-display text-xl font-bold text-brand">Não foi possível continuar</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }
  if (!details) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Carregando pedido de autorização…</p>
      </main>
    );
  }

  const clientName = details.client?.name ?? "Aplicação externa";
  const scopes = (details.scope ?? "").split(/\s+/).filter(Boolean);

  return (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-gradient-soft">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-card space-y-5">
        <header className="space-y-1">
          <h1 className="font-display text-2xl font-bold text-brand">
            Conectar {clientName} ao Chagas Digital Care
          </h1>
          <p className="text-sm text-muted-foreground">
            {clientName} poderá chamar as ferramentas do Chagas Digital Care agindo como você
            enquanto estiver conectado. Todas as regras de acesso do app (papéis, instituição,
            RLS) continuam valendo.
          </p>
        </header>

        {scopes.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-brand">Permissões solicitadas</h2>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {scopes.map((s) => (
                <li key={s}>• {SCOPE_LABELS[s] ?? `Permissão adicional: ${s}`}</li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-xs text-muted-foreground">
          Isso não substitui as políticas de segurança do backend — apenas concede à aplicação
          externa o direito de agir em seu nome dentro dos limites do seu usuário.
        </p>

        <div className="flex gap-3">
          <Button variant="hero" className="flex-1" disabled={busy} onClick={() => decide(true)}>
            {busy ? "Processando…" : "Aprovar"}
          </Button>
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
            Cancelar
          </Button>
        </div>
      </div>
    </main>
  );
}