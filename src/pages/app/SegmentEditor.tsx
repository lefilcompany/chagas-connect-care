import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { qk } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Check, Tag, Users as UsersIcon,
  Filter, ListChecks, Info, Sparkles,
} from "lucide-react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { SegmentFiltersForm } from "@/components/app/SegmentFilters";
import { RecipientPreview } from "@/components/app/RecipientPreview";
import {
  AUDIENCE_LABELS, AudienceType, SegmentDef, SegmentFilters,
  emptyFilters, resolveRecipients,
} from "@/lib/segments";

const nameSchema = z.string().trim().min(2, "O nome precisa ter ao menos 2 caracteres").max(80, "Máximo de 80 caracteres");

type StepKey = "info" | "publico" | "filtros" | "revisao";

const STEPS: { key: StepKey; title: string; subtitle: string; icon: typeof Tag }[] = [
  { key: "info", title: "Identificação", subtitle: "Dê um nome claro ao seu segmento", icon: Tag },
  { key: "publico", title: "Público-alvo", subtitle: "Para quem este segmento se destina", icon: UsersIcon },
  { key: "filtros", title: "Filtros", subtitle: "Refine quem entra neste grupo", icon: Filter },
  { key: "revisao", title: "Revisão", subtitle: "Confira e salve o segmento", icon: ListChecks },
];

export default function SegmentEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isDuplicate = !!params.get("duplicate") || window.location.pathname.endsWith("/duplicar");
  const isEdit = !!id && !isDuplicate;

  const [step, setStep] = useState<number>(0);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [institution, setInstitution] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [audienceTypes, setAudienceTypes] = useState<AudienceType[]>(["paciente"]);
  const [filters, setFilters] = useState<SegmentFilters>(emptyFilters());

  useEffect(() => {
    let active = true;
    (async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from("audience_segments")
        .select("id, name, description, audience_types, filters")
        .eq("id", id)
        .maybeSingle();
      if (!active) return;
      if (error || !data) {
        toast.error("Segmento não encontrado");
        navigate("/app/segmentos", { replace: true });
        return;
      }
      setName(isDuplicate ? `${data.name} (cópia)` : data.name);
      setDescription(data.description ?? "");
      setAudienceTypes(((data.audience_types as AudienceType[]) ?? ["paciente"]));
      setFilters(((data.filters as SegmentFilters) ?? emptyFilters()));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [id, isDuplicate, navigate]);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("profiles").select("institution").eq("id", user.id).maybeSingle()
      .then(({ data }) => setInstitution(data?.institution ?? ""));
  }, [user?.id]);

  const { data: recipients = [], isLoading: loadingPreview } = useQuery({
    queryKey: ["segment-editor-preview", audienceTypes, filters],
    queryFn: () => resolveRecipients(audienceTypes, filters),
    enabled: step === 3,
  });

  const nameOk = nameSchema.safeParse(name).success;
  const audienceOk = audienceTypes.length > 0;

  const canAdvance = useMemo(() => {
    if (step === 0) return nameOk;
    if (step === 1) return audienceOk;
    return true;
  }, [step, nameOk, audienceOk]);

  const goNext = () => {
    if (step === 0 && !nameOk) {
      toast.error("Informe um nome válido (mínimo 2 caracteres)");
      return;
    }
    if (step === 1 && !audienceOk) {
      toast.error("Selecione ao menos um tipo de público");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const save = async () => {
    if (!nameOk) { setStep(0); return toast.error("Informe um nome válido"); }
    if (!audienceOk) { setStep(1); return toast.error("Selecione um público"); }
    setSaving(true);
    const payload = {
      name: name.trim(),
      description,
      audience_types: audienceTypes,
      filters: filters as any,
      institution,
      owner_id: user?.id ?? null,
    };
    const { error } = isEdit
      ? await supabase.from("audience_segments").update(payload).eq("id", id!)
      : await supabase.from("audience_segments").insert(payload as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isEdit ? "Segmento atualizado com sucesso" : "Segmento criado com sucesso");
    queryClient.invalidateQueries({ queryKey: qk.segments });
    navigate("/app/segmentos");
  };

  if (loading) {
    return <div className="p-8 text-muted-foreground">Carregando segmento...</div>;
  }

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
          <Link to="/app/segmentos"><ArrowLeft className="h-4 w-4" /> Voltar para segmentos</Link>
        </Button>
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand">
            {isEdit ? "Editar segmento" : isDuplicate ? "Duplicar segmento" : "Criar novo segmento"}
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Segmentos são listas reutilizáveis que ajudam você a enviar a mensagem certa para o público certo.
            Siga os passos abaixo — leva menos de 2 minutos.
          </p>
        </div>
      </header>

      {/* Stepper */}
      <nav aria-label="Progresso" className="rounded-2xl border border-border bg-card p-3 sm:p-4 shadow-card">
        <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            const StepIcon = s.icon;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => i < step && setStep(i)}
                  disabled={i > step}
                  className={cn(
                    "w-full text-left rounded-xl border p-3 transition-smooth flex items-start gap-3 disabled:cursor-not-allowed",
                    done && "border-brand/30 bg-primary/30 hover:bg-primary/40",
                    active && "border-brand bg-card ring-2 ring-brand/20",
                    !done && !active && "border-border bg-muted/40 opacity-80",
                  )}
                >
                  <div className={cn(
                    "h-8 w-8 shrink-0 rounded-lg flex items-center justify-center",
                    done ? "bg-brand text-brand-foreground" : active ? "bg-primary text-brand" : "bg-muted text-muted-foreground",
                  )}>
                    {done ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Passo {i + 1}</div>
                    <div className="text-sm font-bold text-brand leading-tight truncate">{s.title}</div>
                    <div className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{s.subtitle}</div>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step content */}
      <Card className="p-5 sm:p-7 shadow-card">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="h-10 w-10 rounded-xl bg-primary/50 text-brand flex items-center justify-center">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-brand">{current.title}</h2>
            <p className="text-sm text-muted-foreground">{current.subtitle}</p>
          </div>
        </div>

        <div className="pt-5">
          {step === 0 && (
            <div className="space-y-5">
              <Tip>
                Escolha um nome curto e fácil de reconhecer depois — como “Crônicos do Recife” ou
                “Familiares — fase aguda”. A descrição é opcional, mas ajuda sua equipe a entender o uso.
              </Tip>
              <div className="space-y-1.5">
                <Label htmlFor="seg-name">Nome do segmento *</Label>
                <Input
                  id="seg-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Pacientes crônicos do Recife"
                  autoFocus
                />
                {!nameOk && name.length > 0 && (
                  <p className="text-xs text-destructive">Mínimo de 2 caracteres.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seg-desc">Descrição (opcional)</Label>
                <Textarea
                  id="seg-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Para que este segmento será usado? Ex: envio mensal de orientações alimentares."
                  rows={3}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <Tip>
                Escolha quem deve receber as mensagens deste segmento. Você pode combinar mais de um tipo —
                por exemplo, enviar tanto para o paciente quanto para seus familiares.
              </Tip>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(Object.keys(AUDIENCE_LABELS) as AudienceType[]).map((a) => {
                  const on = audienceTypes.includes(a);
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() =>
                        setAudienceTypes(on ? audienceTypes.filter((x) => x !== a) : [...audienceTypes, a])
                      }
                      className={cn(
                        "rounded-xl border p-4 text-left transition-smooth flex items-start gap-3",
                        on ? "border-brand bg-primary/30 ring-2 ring-brand/20" : "border-border bg-card hover:bg-muted/50",
                      )}
                    >
                      <div className={cn(
                        "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                        on ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground",
                      )}>
                        {on ? <Check className="h-4 w-4" /> : <UsersIcon className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-brand">{AUDIENCE_LABELS[a]}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {audienceHint(a)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {!audienceOk && (
                <p className="text-xs text-destructive">Selecione ao menos um tipo de público para continuar.</p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <Tip>
                Os filtros são <strong>opcionais</strong>. Se você deixar tudo em branco, o segmento incluirá
                todos os contatos do(s) público(s) escolhido(s). Use filtros para refinar — por etapa do paciente,
                cidade, idade, status ou canal preferido.
              </Tip>
              <SegmentFiltersForm
                audienceTypes={audienceTypes}
                onAudienceChange={setAudienceTypes}
                filters={filters}
                onFiltersChange={setFilters}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <Tip>
                Confira o resumo do segmento e a lista de destinatários que ele atinge no momento.
                Você pode editar mais tarde sempre que precisar.
              </Tip>

              <section className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-brand">
                  <Sparkles className="h-4 w-4" />
                  <span className="font-display font-bold">Resumo</span>
                </div>
                <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                  <SummaryItem label="Nome" value={name} />
                  <SummaryItem label="Descrição" value={description || "—"} />
                  <SummaryItem
                    label="Públicos"
                    value={
                      <div className="flex flex-wrap gap-1.5">
                        {audienceTypes.map((a) => <Badge key={a} variant="secondary">{AUDIENCE_LABELS[a]}</Badge>)}
                      </div>
                    }
                  />
                  <SummaryItem label="Filtros" value={<FiltersChips filters={filters} />} />
                </dl>
              </section>

              <div className="space-y-2">
                <Label>Prévia de destinatários</Label>
                <RecipientPreview
                  recipients={recipients}
                  loading={loadingPreview}
                  selectedKeys={new Set(recipients.map((r) => r.key))}
                  onChange={() => { /* leitura */ }}
                  readOnly
                />
                <p className="text-xs text-muted-foreground">
                  A seleção individual de destinatários é feita no momento do envio do conteúdo.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between gap-3 pt-6 mt-6 border-t border-border">
          <Button variant="ghost" onClick={goBack} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <div className="text-xs text-muted-foreground hidden sm:block">
            Passo {step + 1} de {STEPS.length}
          </div>
          {step < STEPS.length - 1 ? (
            <Button variant="hero" onClick={goNext} disabled={!canAdvance}>
              Avançar <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="hero" onClick={save} disabled={saving}>
              {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar segmento"}
              <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-brand/20 bg-primary/20 p-3 text-sm text-brand/90">
      <Info className="h-4 w-4 shrink-0 mt-0.5 text-brand" />
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-brand">{value}</dd>
    </div>
  );
}

function FiltersChips({ filters }: { filters: SegmentFilters }) {
  const chips: string[] = [];
  if (filters.stages?.length) chips.push(`Etapas: ${filters.stages.join(", ")}`);
  if (filters.city) chips.push(`Cidade: ${filters.city}`);
  if (filters.state) chips.push(`UF: ${filters.state}`);
  if (filters.age_min != null) chips.push(`≥ ${filters.age_min} anos`);
  if (filters.age_max != null) chips.push(`≤ ${filters.age_max} anos`);
  if (filters.status) chips.push(`Status: ${filters.status}`);
  if (filters.channel) chips.push(`Canal: ${filters.channel}`);
  if (filters.institution) chips.push(`Instituição: ${filters.institution}`);
  if (!chips.length) return <span className="italic text-muted-foreground text-xs">Sem filtros — todos os registros do público.</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => <Badge key={c} variant="outline" className="text-[10px] font-normal">{c}</Badge>)}
    </div>
  );
}

function audienceHint(a: AudienceType): string {
  switch (a) {
    case "paciente": return "Os próprios pacientes cadastrados.";
    case "familiar": return "Familiares vinculados aos pacientes.";
    case "cuidador": return "Cuidadores responsáveis pelo cuidado diário.";
    case "medico": return "Médicos e profissionais ligados ao paciente.";
  }
}