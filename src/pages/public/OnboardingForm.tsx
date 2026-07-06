import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Heart,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  MessageCircle,
  Mail,
  Phone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Role = "paciente" | "familiar" | "cuidador";

type InviteInfo = {
  ok: true;
  intended_role: Role;
  patient_id: string | null;
  patient_name: string | null;
  institution: string;
};

type ChannelKey = "whatsapp" | "email" | "sms";
type PurposeKey = "clinical" | "reminders" | "education" | "research";

const CHANNELS: { key: ChannelKey; label: string; icon: typeof MessageCircle; help: string }[] = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, help: "Mensagens rápidas, lembretes e conversas com a equipe." },
  { key: "email", label: "E-mail", icon: Mail, help: "Resumos, materiais educativos e comprovantes." },
  { key: "sms", label: "SMS", icon: Phone, help: "Alertas curtos quando o WhatsApp não estiver disponível." },
];

const PURPOSES: { key: PurposeKey; label: string; description: string; required?: boolean }[] = [
  {
    key: "clinical",
    label: "Comunicação clínica e cuidado",
    description:
      "Contato da equipe assistencial sobre seu tratamento, exames, orientações e agendamentos. Necessário para o acompanhamento.",
    required: true,
  },
  {
    key: "reminders",
    label: "Lembretes de medicação e adesão",
    description: "Avisos automáticos de horários, retornos e adesão ao plano de cuidados.",
  },
  {
    key: "education",
    label: "Conteúdos educativos",
    description: "Materiais sobre sua condição, hábitos de saúde e prevenção — enviados com moderação.",
  },
  {
    key: "research",
    label: "Pesquisa e melhoria de serviço",
    description: "Uso de dados anonimizados para pesquisa clínica e melhoria do atendimento.",
  },
];

const TOTAL_STEPS = 8;

export default function OnboardingForm() {
  const { token = "" } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState(1);

  // Form state
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [relation, setRelation] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [channels, setChannels] = useState<Record<ChannelKey, boolean>>({
    whatsapp: true,
    email: false,
    sms: false,
  });
  const [purposes, setPurposes] = useState<Record<PurposeKey, boolean>>({
    clinical: false,
    reminders: false,
    education: false,
    research: false,
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [truthfulAccepted, setTruthfulAccepted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const projectRef = (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID ?? "czrstjmhgfewlsetsrvl";
        const anonKey =
          (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ??
          (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ??
          "";
        const res = await fetch(
          `https://${projectRef}.supabase.co/functions/v1/public-onboarding?token=${encodeURIComponent(token)}`,
          { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !(data as any)?.ok) {
          throw new Error((data as any)?.error ?? `Convite inválido (HTTP ${res.status})`);
        }
        setInvite(data as InviteInfo);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Convite inválido");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const isPatient = invite?.intended_role === "paciente";

  const stepValid = useMemo(() => {
    switch (step) {
      case 1:
        return !!invite;
      case 2:
        return fullName.trim().length >= 3;
      case 3:
        return true; // documentos opcionais
      case 4:
        return phone.replace(/\D/g, "").length >= 10 || email.trim().length > 0;
      case 5:
        return isPatient ? true : relation.trim().length > 0;
      case 6:
        return Object.values(channels).some(Boolean);
      case 7:
        return purposes.clinical === true; // finalidade clínica é obrigatória
      case 8:
        return termsAccepted && truthfulAccepted;
      default:
        return false;
    }
  }, [step, invite, fullName, phone, email, isPatient, relation, channels, purposes, termsAccepted, truthfulAccepted]);

  function next() {
    setError(null);
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }
  function prev() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  async function submit() {
    if (!invite) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("public-onboarding", {
        method: "POST",
        body: {
          token,
          full_name: fullName,
          preferred_name: preferredName.trim() || null,
          birth_date: birthDate || null,
          email: email.trim() || null,
          phone: phone.replace(/\D/g, "") || null,
          cpf: cpf.replace(/\D/g, "") || null,
          address: address.trim() || null,
          city: city.trim() || null,
          state: state.trim().toUpperCase() || null,
          relation: isPatient ? null : relation || invite.intended_role,
          emergency_contact: emergencyName || emergencyPhone
            ? { name: emergencyName.trim() || null, phone: emergencyPhone.replace(/\D/g, "") || null }
            : null,
          channels,
          consents: purposes,
          consent: purposes.clinical, // compatibilidade com backend atual
          accepted_terms: termsAccepted,
          accepted_at: new Date().toISOString(),
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
    <main className="min-h-dvh bg-gradient-to-b from-brand/5 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg p-6 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-brand">
            <Heart className="h-6 w-6" aria-hidden />
            <h1 className="text-xl font-bold">Finalize seu cadastro</h1>
          </div>
          {invite && !done && !error && (
            <span className="text-xs text-muted-foreground" aria-live="polite">
              Passo {step} de {TOTAL_STEPS}
            </span>
          )}
        </div>

        {invite && !done && !error && (
          <Progress value={(step / TOTAL_STEPS) * 100} aria-label={`Progresso ${step} de ${TOTAL_STEPS}`} />
        )}

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error && !invite ? (
          <ErrorBlock message={error} />
        ) : done ? (
          <div className="text-sm flex items-start gap-2 text-green-700">
            <CheckCircle2 className="h-5 w-5 mt-0.5" />
            <div>
              <div className="font-medium">Cadastro concluído!</div>
              <div className="text-muted-foreground">
                Em breve nossa equipe entrará em contato pelos canais autorizados.
              </div>
            </div>
          </div>
        ) : invite ? (
          <div className="space-y-5">
            {step === 1 && (
              <StepWrapper title="Bem-vindo(a)" icon={<ShieldCheck className="h-5 w-5 text-brand" />}> 
                <p className="text-sm text-muted-foreground">
                  {isPatient
                    ? `A equipe de ${invite.institution} preparou este cadastro para acompanhar seu tratamento com mais segurança.`
                    : `Cadastro de ${invite.intended_role}${invite.patient_name ? ` para acompanhar ${invite.patient_name}` : ""} na instituição ${invite.institution}.`}
                </p>
                <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                  <p><strong className="text-foreground">O que vamos pedir:</strong> dados pessoais básicos, contato e as suas preferências de comunicação.</p>
                  <p><strong className="text-foreground">Tempo estimado:</strong> cerca de 3 minutos.</p>
                  <p><strong className="text-foreground">Seus direitos:</strong> você pode revisar, alterar ou revogar consentimentos a qualquer momento.</p>
                </div>
              </StepWrapper>
            )}

            {step === 2 && (
              <StepWrapper title="Identidade">
                <div>
                  <Label htmlFor="full_name">Nome completo</Label>
                  <Input id="full_name" required autoFocus value={fullName}
                    onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="preferred_name">Como prefere ser chamado(a)?</Label>
                  <Input id="preferred_name" placeholder="Opcional" value={preferredName}
                    onChange={(e) => setPreferredName(e.target.value)} />
                </div>
                {isPatient && (
                  <div>
                    <Label htmlFor="birth">Data de nascimento</Label>
                    <Input id="birth" type="date" value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)} />
                  </div>
                )}
              </StepWrapper>
            )}

            {step === 3 && (
              <StepWrapper title="Documento">
                <div>
                  <Label htmlFor="cpf">CPF</Label>
                  <Input id="cpf" inputMode="numeric" placeholder="Somente números"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value.replace(/\D/g, "").slice(0, 11))} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Opcional. Usado apenas para confirmar sua identidade em atendimentos.
                  </p>
                </div>
              </StepWrapper>
            )}

            {step === 4 && (
              <StepWrapper title="Contato">
                <div>
                  <Label htmlFor="phone">Telefone / WhatsApp</Label>
                  <Input id="phone" inputMode="tel" placeholder="(DDD) 9 9999-9999"
                    value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" placeholder="voce@email.com"
                    value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="city">Cidade</Label>
                    <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="state">UF</Label>
                    <Input id="state" maxLength={2} value={state}
                      onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="address">Endereço</Label>
                  <Input id="address" placeholder="Opcional" value={address}
                    onChange={(e) => setAddress(e.target.value)} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Informe ao menos um telefone ou e-mail para receber comunicações.
                </p>
              </StepWrapper>
            )}

            {step === 5 && (
              <StepWrapper title={isPatient ? "Contato de emergência" : "Sua relação com o paciente"}>
                {!isPatient && (
                  <div>
                    <Label htmlFor="relation">Grau de parentesco ou função</Label>
                    <Input id="relation" placeholder="Ex.: Filha, esposo, cuidador formal"
                      value={relation} onChange={(e) => setRelation(e.target.value)} />
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label htmlFor="em_name">Nome do contato de emergência</Label>
                    <Input id="em_name" placeholder="Opcional" value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="em_phone">Telefone do contato</Label>
                    <Input id="em_phone" inputMode="tel" placeholder="Opcional"
                      value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} />
                  </div>
                </div>
              </StepWrapper>
            )}

            {step === 6 && (
              <StepWrapper title="Canais de comunicação">
                <p className="text-sm text-muted-foreground">
                  Escolha em quais canais podemos falar com você. Você pode ativar mais de um.
                </p>
                <div className="space-y-2">
                  {CHANNELS.map((c) => {
                    const Icon = c.icon;
                    const checked = channels[c.key];
                    return (
                      <label
                        key={c.key}
                        className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                          checked ? "border-brand bg-brand/5" : "hover:bg-muted/40"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            setChannels((prev) => ({ ...prev, [c.key]: !!v }))
                          }
                          className="mt-0.5"
                          aria-label={c.label}
                        />
                        <Icon className="h-5 w-5 mt-0.5 text-muted-foreground" aria-hidden />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{c.label}</div>
                          <div className="text-xs text-muted-foreground">{c.help}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </StepWrapper>
            )}

            {step === 7 && (
              <StepWrapper title="Consentimentos por finalidade">
                <p className="text-sm text-muted-foreground">
                  Autorize cada uso separadamente. Você pode revogar depois a qualquer momento.
                </p>
                <div className="space-y-2">
                  {PURPOSES.map((p) => {
                    const checked = purposes[p.key];
                    return (
                      <label
                        key={p.key}
                        className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                          checked ? "border-brand bg-brand/5" : "hover:bg-muted/40"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            setPurposes((prev) => ({ ...prev, [p.key]: !!v }))
                          }
                          className="mt-0.5"
                          aria-label={p.label}
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium flex items-center gap-2">
                            {p.label}
                            {p.required && (
                              <span className="text-[10px] uppercase tracking-wide text-brand">
                                Obrigatório
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{p.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                {!purposes.clinical && (
                  <p className="text-xs text-destructive">
                    O consentimento clínico é necessário para prosseguir com o acompanhamento.
                  </p>
                )}
              </StepWrapper>
            )}

            {step === 8 && (
              <StepWrapper title="Revisão e envio">
                <div className="rounded-md border p-3 text-sm space-y-2">
                  <ReviewRow label="Nome" value={fullName} />
                  {preferredName && <ReviewRow label="Prefere ser chamado" value={preferredName} />}
                  {birthDate && <ReviewRow label="Nascimento" value={birthDate} />}
                  {cpf && <ReviewRow label="CPF" value={maskCpf(cpf)} />}
                  {phone && <ReviewRow label="Telefone" value={phone} />}
                  {email && <ReviewRow label="E-mail" value={email} />}
                  {(city || state) && <ReviewRow label="Cidade/UF" value={`${city}${state ? `/${state}` : ""}`} />}
                  {!isPatient && relation && <ReviewRow label="Relação" value={relation} />}
                  <ReviewRow
                    label="Canais"
                    value={
                      CHANNELS.filter((c) => channels[c.key]).map((c) => c.label).join(", ") || "—"
                    }
                  />
                  <ReviewRow
                    label="Finalidades autorizadas"
                    value={
                      PURPOSES.filter((p) => purposes[p.key]).map((p) => p.label).join(", ") || "—"
                    }
                  />
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={truthfulAccepted}
                    onCheckedChange={(v) => setTruthfulAccepted(!!v)} className="mt-0.5" />
                  <span className="text-muted-foreground">
                    Declaro que as informações prestadas são verdadeiras.
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={termsAccepted}
                    onCheckedChange={(v) => setTermsAccepted(!!v)} className="mt-0.5" />
                  <span className="text-muted-foreground">
                    Li e aceito a Política de Privacidade e os Termos de Uso conforme a LGPD.
                  </span>
                </label>
                {error && (
                  <div className="text-xs text-destructive flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
              </StepWrapper>
            )}

            <div className="flex items-center justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={prev}
                disabled={step === 1 || submitting}
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              {step < TOTAL_STEPS ? (
                <Button type="button" onClick={next} disabled={!stepValid}>
                  Avançar <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button type="button" onClick={submit} disabled={!stepValid || submitting}>
                  {submitting ? "Enviando..." : "Concluir cadastro"}
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </Card>
    </main>
  );
}

function StepWrapper({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4" aria-labelledby="step-title">
      <div className="flex items-center gap-2">
        {icon}
        <h2 id="step-title" className="text-base font-semibold">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium break-words">{value}</span>
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="text-sm flex items-start gap-2 text-destructive">
      <AlertCircle className="h-4 w-4 mt-0.5" />
      <div>
        <div className="font-medium">Não foi possível abrir este convite</div>
        <div className="text-muted-foreground">{message}</div>
      </div>
    </div>
  );
}

function maskCpf(cpf: string) {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return "•••.•••.•••-••";
  return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
}