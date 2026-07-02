import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { qk } from "@/lib/queries";
import {
  useInstitutionIdentity,
  useInstitutionTemplateService,
} from "@/services/institutionTemplates";
import {
  templateDraftSchema,
  validateTemplateDraft,
  type TemplateDraftInput,
} from "@/lib/templateDraft";
import { TemplateEditorForm } from "@/components/app/messages/TemplateEditorForm";
import type { MessageTemplate } from "@/lib/templates";

function templateToDraft(t: MessageTemplate): TemplateDraftInput {
  const header = (t as unknown as { meta_header?: { type?: string; text?: string } })
    .meta_header;
  const buttons = (t as unknown as { meta_buttons?: unknown[] }).meta_buttons ?? [];
  return templateDraftSchema.parse({
    name: t.name,
    description: t.description ?? "",
    category: t.category ?? "geral",
    template_kind: t.template_kind ?? "meta",
    body: t.body ?? "",
    meta_template_name: t.meta_template_name ?? "",
    meta_language: t.meta_language ?? "pt_BR",
    meta_category: (t.meta_category as "UTILITY" | "MARKETING" | "AUTHENTICATION") ?? "UTILITY",
    meta_header_type: (header?.type === "text" ? "text" : "none"),
    meta_header_text: header?.text ?? "",
    meta_footer_text: t.meta_footer_text ?? "",
    meta_buttons: Array.isArray(buttons) ? (buttons as TemplateDraftInput["meta_buttons"]) : [],
    variable_examples: {},
    targeting_mode: t.targeting_mode ?? "all",
    audience_types: (t.audience_types as string[]) ?? [],
  } as Partial<TemplateDraftInput>);
}

export default function MessageTemplateEdit() {
  const { templateId = "" } = useParams();
  const identity = useInstitutionIdentity();
  const service = useInstitutionTemplateService();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["template-by-id", templateId],
    queryFn: () => service.getById(templateId),
    enabled: !!templateId,
  });

  const [form, setForm] = useState<TemplateDraftInput | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (query.data && !form) setForm(templateToDraft(query.data));
  }, [query.data, form]);

  const updateMutation = useMutation({
    mutationFn: async (input: TemplateDraftInput) => service.updateDraft(templateId, input),
    onSuccess: () => {
      toast.success("Rascunho atualizado.");
      qc.invalidateQueries({
        queryKey: qk.institutionTemplates(identity.institution ?? ""),
      });
      navigate("/app/modelos");
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao atualizar rascunho."),
  });

  const isLocked = useMemo(
    () => !!query.data && query.data.meta_status !== "not_submitted",
    [query.data],
  );

  if (!identity.loading && !identity.isAdmin) {
    return <Navigate to="/app/modelos" replace />;
  }

  if (query.isLoading || !form) {
    return <p className="text-sm text-muted-foreground">Carregando modelo…</p>;
  }

  if (!query.data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">Modelo não encontrado.</p>
        <Button asChild variant="outline">
          <Link to="/app/modelos">Voltar</Link>
        </Button>
      </div>
    );
  }

  const handleChange = (patch: Partial<TemplateDraftInput>) =>
    setForm((cur) => (cur ? { ...cur, ...patch } : cur));

  const handleSubmit = () => {
    if (!form) return;
    const result = validateTemplateDraft(form);
    if (!result.ok) {
      setErrors(result.errors);
      toast.error("Corrija os campos destacados.");
      return;
    }
    setErrors({});
    updateMutation.mutate(result.data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/modelos" aria-label="Voltar para modelos">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </Button>
      </div>

      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-brand">Editar modelo</h1>
        <p className="text-sm text-muted-foreground">
          {isLocked
            ? "Este modelo já foi enviado à Meta e não pode ser editado nesta fase."
            : "Ajuste o rascunho e salve para atualizar."}
        </p>
      </header>

      {isLocked && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-900 dark:text-amber-200"
        >
          <ShieldCheck className="mt-0.5 h-4 w-4" />
          <p>
            Modelos enviados ou aprovados pela Meta não podem ser sobrescritos. Crie uma nova
            versão em uma próxima etapa.
          </p>
        </div>
      )}

      <TemplateEditorForm
        value={form}
        onChange={handleChange}
        errors={errors}
        disabled={isLocked}
        statusBadge={
          <Badge variant="outline">
            {query.data.meta_status === "not_submitted" ? "Rascunho" : query.data.meta_status}
          </Badge>
        }
      />

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline">
          <Link to="/app/modelos">Cancelar</Link>
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isLocked || updateMutation.isPending}
        >
          <Save className="h-4 w-4" />
          {updateMutation.isPending ? "Salvando…" : "Salvar rascunho"}
        </Button>
      </div>
    </div>
  );
}
