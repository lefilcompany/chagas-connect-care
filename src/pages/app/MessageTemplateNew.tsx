import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { qk } from "@/lib/queries";
import {
  useInstitutionIdentity,
  useInstitutionTemplateService,
} from "@/services/institutionTemplates";
import {
  validateTemplateDraft,
  type TemplateDraftInput,
} from "@/lib/templateDraft";
import { TemplateEditorForm } from "@/components/app/messages/TemplateEditorForm";
import { useInstitutionDefaultFooter } from "@/hooks/useInstitutionDefaultFooter";

const emptyDraft = (): TemplateDraftInput => ({
  name: "",
  description: "",
  category: "geral",
  template_kind: "meta",
  body: "",
  meta_template_name: "",
  meta_language: "pt_BR",
  meta_category: "UTILITY",
  meta_header_type: "none",
  meta_header_text: "",
  meta_header_handle: "",
  meta_header_media_id: null,
  meta_header_format: null,
  meta_header_media_file_name: "",
  meta_header_media_mime: "",
  meta_header_media_size: 0,
  meta_footer_text: "",
  meta_buttons: [],
  variable_examples: {},
  targeting_mode: "all",
  audience_types: [],
});

export default function MessageTemplateNew() {
  const identity = useInstitutionIdentity();
  const service = useInstitutionTemplateService();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState<TemplateDraftInput>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { defaultFooter } = useInstitutionDefaultFooter(identity.institution);

  const createMutation = useMutation({
    mutationFn: async (input: TemplateDraftInput) =>
      service.createDraft(input, {
        institution: identity.institution ?? "",
        userId: user?.id ?? "",
      }),
    onSuccess: () => {
      toast.success("Rascunho criado.");
      qc.invalidateQueries({
        queryKey: qk.institutionTemplates(identity.institution ?? ""),
      });
      navigate("/app/modelos");
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao criar rascunho."),
  });

  const canAdmin = useMemo(
    () => !identity.loading && identity.isAdmin,
    [identity.loading, identity.isAdmin],
  );

  if (!identity.loading && !identity.isAdmin) {
    return <Navigate to="/app/modelos" replace />;
  }

  const handleChange = (patch: Partial<TemplateDraftInput>) =>
    setForm((cur) => ({ ...cur, ...patch }));

  const handleSubmit = () => {
    const result = validateTemplateDraft(form);
    if (!result.ok) {
      setErrors(result.errors);
      toast.error("Corrija os campos destacados.");
      return;
    }
    setErrors({});
    createMutation.mutate(result.data);
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
        <h1 className="font-display text-2xl font-bold text-brand">Novo modelo</h1>
        <p className="text-sm text-muted-foreground">
          Crie um rascunho local. Nada será enviado à Meta agora.
        </p>
      </header>

      <TemplateEditorForm
        value={form}
        onChange={handleChange}
        errors={errors}
        disabled={!canAdmin}
        statusBadge={<Badge variant="outline">Rascunho</Badge>}
        institutionDefaultFooter={defaultFooter}
      />

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline">
          <Link to="/app/modelos">Cancelar</Link>
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={createMutation.isPending}
        >
          <Save className="h-4 w-4" />
          {createMutation.isPending ? "Salvando…" : "Salvar rascunho"}
        </Button>
      </div>
    </div>
  );
}
