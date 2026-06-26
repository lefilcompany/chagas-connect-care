import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type InviteInfo = {
  ok: true;
  intended_role: "paciente" | "familiar" | "cuidador";
  patient_id: string | null;
  patient_name: string | null;
  institution: string;
};

export default function OnboardingForm() {
  const { token = "" } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [relation, setRelation] = useState("");
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          `public-onboarding?token=${encodeURIComponent(token)}`,
          { method: "GET" as any },
        );
        if (error) throw error;
        if (!(data as any)?.ok) throw new Error((data as any)?.error ?? "Convite inválido");
        setInvite(data as InviteInfo);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Convite inválido");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!invite) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("public-onboarding", {
        method: "POST",
        body: {
          token,
          full_name: fullName,
          birth_date: birthDate || null,
          relation: invite.intended_role === "paciente" ? null : (relation || invite.intended_role),
          consent,
        },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error ?? "Não foi possível concluir");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand/5 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 space-y-5">
        <div className="flex items-center gap-2 text-brand">
          <Heart className="h-6 w-6" />
          <h1 className="text-xl font-bold">Finalize seu cadastro</h1>
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <div className="text-sm flex items-start gap-2 text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <div>
              <div className="font-medium">Não foi possível abrir este convite</div>
              <div className="text-muted-foreground">{error}</div>
            </div>
          </div>
        ) : done ? (
          <div className="text-sm flex items-start gap-2 text-green-700">
            <CheckCircle2 className="h-5 w-5 mt-0.5" />
            <div>
              <div className="font-medium">Cadastro concluído!</div>
              <div className="text-muted-foreground">
                Em breve nossa equipe entrará em contato pelo WhatsApp.
              </div>
            </div>
          </div>
        ) : invite ? (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {invite.intended_role === "paciente"
                ? "Preencha seus dados para que possamos acompanhar seu tratamento com mais segurança."
                : `Cadastro de ${invite.intended_role}${invite.patient_name ? ` para acompanhar ${invite.patient_name}` : ""}.`}
            </p>
            <div>
              <Label htmlFor="full_name">Nome completo</Label>
              <Input id="full_name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            {invite.intended_role === "paciente" && (
              <div>
                <Label htmlFor="birth">Data de nascimento</Label>
                <Input id="birth" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </div>
            )}
            {invite.intended_role !== "paciente" && (
              <div>
                <Label htmlFor="relation">Grau de parentesco / função</Label>
                <Input id="relation" placeholder="Ex.: Filha, esposo, cuidador formal"
                  value={relation} onChange={(e) => setRelation(e.target.value)} />
              </div>
            )}
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
              <span className="text-muted-foreground">
                Autorizo o uso dos meus dados para comunicação relacionada ao cuidado em saúde,
                conforme a Política de Privacidade.
              </span>
            </label>
            <Button type="submit" className="w-full" disabled={submitting || !consent || !fullName.trim()}>
              {submitting ? "Enviando..." : "Concluir cadastro"}
            </Button>
          </form>
        ) : null}
      </Card>
    </div>
  );
}