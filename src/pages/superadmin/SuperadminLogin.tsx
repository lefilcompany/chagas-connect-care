import { FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, Loader2 } from "lucide-react";

export default function SuperadminLogin() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // Se já estiver logado, valida o papel e redireciona.
  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      setChecking(true);
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "superadmin")
        .maybeSingle();
      if (cancelled) return;
      if (data) navigate("/superadmin/whatsapp", { replace: true });
      else setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [user, loading, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr || !signIn.user) {
      setSubmitting(false);
      setError(signInErr?.message ?? "Credenciais inválidas.");
      return;
    }
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", signIn.user.id)
      .eq("role", "superadmin")
      .maybeSingle();
    if (!role) {
      await supabase.auth.signOut();
      setSubmitting(false);
      setError("Esta conta não possui acesso de superadministrador.");
      return;
    }
    setSubmitting(false);
    navigate("/superadmin/whatsapp", { replace: true });
  }

  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-sm p-6 space-y-5 border-slate-800 bg-slate-900 text-slate-100">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="rounded-full bg-slate-800 p-3">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
          </div>
          <h1 className="text-lg font-semibold">Central Superadmin</h1>
          <p className="text-xs text-slate-400">Acesso restrito. Autentique-se com uma conta autorizada.</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sa-email" className="text-slate-200">E-mail</Label>
            <Input
              id="sa-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-slate-950 border-slate-800 text-slate-100"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sa-password" className="text-slate-200">Senha</Label>
            <Input
              id="sa-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-slate-950 border-slate-800 text-slate-100"
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
          </Button>
        </form>

        <p className="text-[11px] text-center text-slate-500">
          Este acesso é independente da área da aplicação.
        </p>
      </Card>
    </div>
  );
}