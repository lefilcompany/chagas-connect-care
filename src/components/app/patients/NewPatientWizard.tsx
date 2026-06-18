import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Check, ArrowLeft, ArrowRight, User, HeartPulse, Settings2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { qk } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

function formatPhone(value: string) {
  const d = value.replace(/\D/g, "");
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}
function formatCep(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}
function formatCpf(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

const personalSchema = z.object({
  full_name: z.string().trim().min(2, "Informe o nome completo").max(160),
  phone: z.string().trim().regex(/^\(\d{2}\) \d{4,5}-\d{4}$/, "Telefone deve ter 10 ou 11 dígitos"),
  email: z.string().trim().email("E-mail inválido").max(160).or(z.literal("")).optional(),
  birth_date: z.string().optional(),
  cpf: z.string().trim().max(20).optional(),
  cep: z.string().trim().max(10).optional(),
  address: z.string().trim().max(240).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(2).optional(),
});

const healthSchema = z.object({
  stage: z.enum(["diagnostico", "agudo", "cronico"]),
  clinical_form: z.enum(["", "indeterminada", "cardiaca", "digestiva", "mista"]).optional(),
  diagnosis_date: z.string().optional(),
  weight_kg: z.string().optional(),
  height_cm: z.string().optional(),
  blood_type: z.string().optional(),
  comorbidities: z.string().max(2000).optional(),
  allergies: z.string().max(2000).optional(),
  current_medications: z.string().max(2000).optional(),
});

const prefsSchema = z.object({
  channel_pref: z.enum(["whatsapp", "sms"]),
  status: z.enum(["ativo", "inativo"]),
  notes: z.string().max(2000).optional(),
});

const STEPS = [
  { id: 0, label: "Pessoais", icon: User },
  { id: 1, label: "Saúde", icon: HeartPulse },
  { id: 2, label: "Preferências", icon: Settings2 },
] as const;

type FormState = {
  full_name: string; phone: string; email: string; birth_date: string; cpf: string;
  cep: string; address: string; city: string; state: string;
  stage: "diagnostico" | "agudo" | "cronico";
  clinical_form: "" | "indeterminada" | "cardiaca" | "digestiva" | "mista";
  diagnosis_date: string; weight_kg: string; height_cm: string; blood_type: string;
  comorbidities: string; allergies: string; current_medications: string;
  channel_pref: "whatsapp" | "sms"; status: "ativo" | "inativo"; notes: string;
};

const initialForm: FormState = {
  full_name: "", phone: "", email: "", birth_date: "", cpf: "",
  cep: "", address: "", city: "", state: "",
  stage: "diagnostico", clinical_form: "", diagnosis_date: "",
  weight_kg: "", height_cm: "", blood_type: "",
  comorbidities: "", allergies: "", current_medications: "",
  channel_pref: "whatsapp", status: "ativo", notes: "",
};

export function NewPatientWizard({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [cepLoading, setCepLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setForm(initialForm);
    }
  }, [open]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  async function lookupCep(value: string) {
    const digits = value.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data?.erro) return toast.error("CEP não encontrado");
      setForm((s) => ({
        ...s,
        address: [data.logradouro, data.bairro].filter(Boolean).join(", "),
        city: data.localidade || "",
        state: (data.uf || "").toUpperCase(),
      }));
    } catch {
      toast.error("Não foi possível buscar o CEP");
    } finally {
      setCepLoading(false);
    }
  }

  const validateStep = (s: number): boolean => {
    const target = s === 0 ? personalSchema : s === 1 ? healthSchema : prefsSchema;
    const parsed = target.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return false;
    }
    return true;
  };

  const next = () => { if (validateStep(step)) setStep((s) => Math.min(2, s + 1)); };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const submit = async () => {
    if (!validateStep(0) || !validateStep(1) || !validateStep(2)) return;
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      owner_id: user!.id,
      full_name: form.full_name,
      phone: form.phone,
      email: form.email,
      birth_date: form.birth_date || null,
      cpf: form.cpf,
      address: form.address,
      city: form.city,
      state: form.state.toUpperCase(),
      stage: form.stage,
      clinical_form: form.clinical_form || null,
      diagnosis_date: form.diagnosis_date || null,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      height_cm: form.height_cm ? Number(form.height_cm) : null,
      blood_type: form.blood_type || null,
      comorbidities: form.comorbidities ?? "",
      allergies: form.allergies ?? "",
      current_medications: form.current_medications ?? "",
      channel_pref: form.channel_pref,
      status: form.status,
      notes: form.notes ?? "",
    };
    const { error } = await supabase.from("patients").insert(payload as any);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Paciente cadastrado");
    onOpenChange(false);
    queryClient.invalidateQueries({ queryKey: qk.patients });
    queryClient.invalidateQueries({ queryKey: qk.dashboard });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar paciente</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <ol className="flex items-center gap-2 pt-1">
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            const Icon = s.icon;
            return (
              <li key={s.id} className="flex items-center gap-2 flex-1">
                <div className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                  active && "bg-primary/20 text-brand border-brand/40",
                  done && "bg-brand text-brand-foreground border-brand",
                  !active && !done && "bg-muted text-muted-foreground border-border",
                )}>
                  {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  <span>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn("h-0.5 flex-1 rounded", i < step ? "bg-brand" : "bg-border")} />
                )}
              </li>
            );
          })}
        </ol>

        <div className="pt-2 space-y-4">
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label>Nome completo *</Label>
                <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="Ex: Maria da Silva" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Telefone *</Label>
                  <Input value={form.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} type="tel" placeholder="(81) 99999-9999" maxLength={15} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input value={form.email} onChange={(e) => set("email", e.target.value)} type="email" placeholder="email@exemplo.com" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Data de nascimento</Label>
                  <Input type="date" value={form.birth_date} onChange={(e) => set("birth_date", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input value={form.cpf} onChange={(e) => set("cpf", formatCpf(e.target.value))} placeholder="000.000.000-00" maxLength={14} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr_120px] gap-3">
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <div className="relative">
                    <Input
                      value={form.cep}
                      maxLength={9}
                      placeholder="00000-000"
                      onChange={(e) => {
                        const v = formatCep(e.target.value);
                        set("cep", v);
                        const digits = v.replace(/\D/g, "");
                        if (digits.length === 8) lookupCep(v);
                        else if (digits.length === 0) {
                          setForm((s) => ({ ...s, address: "", city: "", state: "" }));
                        }
                      }}
                      onBlur={(e) => lookupCep(e.target.value)}
                    />
                    {cepLoading && <Loader2 className="h-4 w-4 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Ex: Recife" />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input value={form.state} maxLength={2} className="uppercase" placeholder="SP"
                    onChange={(e) => set("state", e.target.value.toUpperCase())} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Rua, número, complemento" />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Etapa da doença *</Label>
                  <Select value={form.stage} onValueChange={(v) => set("stage", v as FormState["stage"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diagnostico">Diagnóstico</SelectItem>
                      <SelectItem value="agudo">Agudo</SelectItem>
                      <SelectItem value="cronico">Crônico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Forma clínica</Label>
                  <Select value={form.clinical_form || "none"} onValueChange={(v) => set("clinical_form", (v === "none" ? "" : v) as FormState["clinical_form"])}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não informado</SelectItem>
                      <SelectItem value="indeterminada">Indeterminada</SelectItem>
                      <SelectItem value="cardiaca">Cardíaca</SelectItem>
                      <SelectItem value="digestiva">Digestiva</SelectItem>
                      <SelectItem value="mista">Mista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Data do diagnóstico</Label>
                  <Input type="date" value={form.diagnosis_date} onChange={(e) => set("diagnosis_date", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo sanguíneo</Label>
                  <Select value={form.blood_type || "none"} onValueChange={(v) => set("blood_type", v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não sabe</SelectItem>
                      {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Peso (kg)</Label>
                  <Input type="number" inputMode="decimal" min="0" step="0.1" value={form.weight_kg}
                    onChange={(e) => set("weight_kg", e.target.value)} placeholder="Ex: 70" />
                </div>
                <div className="space-y-2">
                  <Label>Altura (cm)</Label>
                  <Input type="number" inputMode="numeric" min="0" step="1" value={form.height_cm}
                    onChange={(e) => set("height_cm", e.target.value)} placeholder="Ex: 170" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Comorbidades</Label>
                <Textarea rows={2} value={form.comorbidities} onChange={(e) => set("comorbidities", e.target.value)} placeholder="Ex: hipertensão, diabetes tipo 2" />
              </div>
              <div className="space-y-2">
                <Label>Alergias</Label>
                <Textarea rows={2} value={form.allergies} onChange={(e) => set("allergies", e.target.value)} placeholder="Ex: penicilina, dipirona" />
              </div>
              <div className="space-y-2">
                <Label>Medicações em uso</Label>
                <Textarea rows={2} value={form.current_medications} onChange={(e) => set("current_medications", e.target.value)} placeholder="Ex: losartana 50mg 1x/dia" />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Canal preferido *</Label>
                  <Select value={form.channel_pref} onValueChange={(v) => set("channel_pref", v as FormState["channel_pref"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => set("status", v as FormState["status"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea rows={4} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Ex: alergia a penicilina, prefere contato pela manhã" />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border mt-2">
          <Button type="button" variant="outline" onClick={back} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <div className="text-xs text-muted-foreground">Etapa {step + 1} de {STEPS.length}</div>
          {step < STEPS.length - 1 ? (
            <Button type="button" variant="hero" onClick={next}>
              Próximo <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" variant="hero" onClick={submit} disabled={submitting}>
              {submitting ? "Salvando..." : "Cadastrar paciente"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}