import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Activity, RefreshCw, Save, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { qk } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import {
  useInstitutionIdentity,
  useInstitutionTemplateService,
} from "@/services/institutionTemplates";
import {
  validateTemplateDraft,
  type TemplateDraftInput,
} from "@/lib/templateDraft";
import { TemplateEditorForm } from "@/components/app/messages/TemplateEditorForm";
import type { MessageTemplate } from "@/lib/templates";

function templateToDraft(t: MessageTemplate): TemplateDraftInput {
  const header = (t as unknown as { meta_header?: { type?: string; text?: string } })
    .meta_header;
  const buttons = (t as unknown as { meta_buttons?: unknown[] }).meta_buttons ?? [];
  const raw = t as unknown as {
    meta_header_type?: string | null;
    meta_header_text?: string | null;
    meta_header_handle?: string | null;
    meta_header_format?: "IMAGE" | "VIDEO" | "DOCUMENT" | null;
    meta_header_media_id?: string | null;
  };
  const headerTypeRaw = raw.meta_header_type ?? header?.type ?? "none";
  const headerType = (["none", "text", "image", "video", "document"] as const).includes(
    headerTypeRaw as never,
  )
    ? (headerTypeRaw as TemplateDraftInput["meta_header_type"])
    : "none";
  return {
    name: t.name ?? "",
    description: t.description ?? "",
    category: t.category || "geral",
    template_kind: (t.template_kind ?? "meta") as "internal" | "meta",
    body: t.body ?? "",
    meta_template_name: t.meta_template_name ?? "",
    meta_language: t.meta_language ?? "pt_BR",
    meta_category:
      (t.meta_category as "UTILITY" | "MARKETING" | "AUTHENTICATION") ?? "UTILITY",
    meta_header_type: headerType,
    meta_header_text: raw.meta_header_text ?? header?.text ?? "",
    meta_header_handle: raw.meta_header_handle ?? "",
    meta_header_media_id: raw.meta_header_media_id ?? null,
    meta_header_format: raw.meta_header_format ?? null,
    meta_header_media_file_name: "",
    meta_header_media_mime: "",
    meta_header_media_size: 0,
    meta_footer_text: t.meta_footer_text ?? "",
    meta_buttons: Array.isArray(buttons)
      ? (buttons as TemplateDraftInput["meta_buttons"])
      : [],
    variable_examples: {},
    targeting_mode: (t.targeting_mode ?? "all") as TemplateDraftInput["targeting_mode"],
    audience_types: ((t.audience_types as string[]) ?? []) as string[],
  };
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
    refetchInterval: (q) => {
      const status = (q.state.data as MessageTemplate | null)?.meta_status;
      // Polling fallback: only while awaiting Meta review.
      return status === "submitted" ? 20000 : false;
    },
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

  const submitMutation = useMutation({
    mutationFn: async () => service.submitToMeta(templateId),
    onSuccess: (r) => {
      toast.success(
        r.deduplicated
          ? "Modelo já havia sido enviado; status atualizado."
          : "Enviado para análise da Meta.",
      );
      qc.invalidateQueries({
        queryKey: qk.institutionTemplates(identity.institution ?? ""),
      });
      qc.invalidateQueries({ queryKey: ["template-by-id", templateId] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao enviar modelo."),
  });

  const syncMutation = useMutation({
    mutationFn: async () => service.syncFromMeta(templateId),
    onSuccess: () => {
      toast.success("Status atualizado a partir da Meta.");
      qc.invalidateQueries({ queryKey: ["template-by-id", templateId] });
      qc.invalidateQueries({
        queryKey: qk.institutionTemplates(identity.institution ?? ""),
      });
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao sincronizar."),
  });

  const uploadMediaMutation = useMutation({
    mutationFn: async (file: File) => service.uploadHeaderMedia(templateId, file),
    onSuccess: (r) => {
      toast.success("Amostra enviada à Meta.");
      setForm((cur) =>
        cur
          ? {
              ...cur,
              meta_header_handle: r.header_handle,
              meta_header_format: r.format,
              meta_header_media_id: r.media_id,
            }
          : cur,
      );
      qc.invalidateQueries({ queryKey: ["template-by-id", templateId] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao enviar amostra."),
  });

  // Realtime: refresh the row whenever Meta (via the webhook) updates it.
  useEffect(() => {
    if (!templateId) return;
    const channel = supabase
      .channel(`template-detail-${templateId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "message_templates",
          filter: `id=eq.${templateId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["template-by-id", templateId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [templateId, qc]);

  const isLocked = useMemo(
    () => !!query.data && query.data.meta_status !== "not_submitted",
    [query.data],
  );

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

  const canEdit = identity.isAdmin;
  const readOnly = !canEdit || isLocked;
  const showMetaPanel =
    query.data.template_kind === "meta" && query.data.meta_status !== "not_submitted";

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
        <h1 className="font-display text-2xl font-bold text-brand">
          {canEdit ? "Editar modelo" : "Detalhes do modelo"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {!canEdit
            ? "Visualização somente leitura. Acompanhe o status de aprovação abaixo."
            : isLocked
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
          <div className="space-y-1">
            <p>
              Modelos enviados ou aprovados pela Meta não podem ser sobrescritos. Crie uma
              nova versão em uma próxima etapa.
            </p>
            {query.data.meta_template_id && (() => {
              const submittedAt = (query.data as unknown as { meta_submitted_at?: string | null })
                .meta_submitted_at;
              return (
                <p className="text-xs">
                  ID Meta: <code>{query.data.meta_template_id}</code>
                  {submittedAt ? (
                    <> · Enviado em {new Date(submittedAt).toLocaleString("pt-BR")}</>
                  ) : null}
                </p>
              );
            })()}
          </div>
        </div>
      )}

      <TemplateEditorForm
        value={form}
        onChange={handleChange}
        errors={errors}
        disabled={readOnly}
        onUploadHeaderMedia={async (file) => {
          await uploadMediaMutation.mutateAsync(file);
        }}
        uploadingHeaderMedia={uploadMediaMutation.isPending}
        statusBadge={
          <Badge variant="outline">
            {query.data.meta_status === "not_submitted" ? "Rascunho" : query.data.meta_status}
          </Badge>
        }
      />

      {showMetaPanel && (
        <MetaStatusPanel
          template={query.data}
          onSync={() => syncMutation.mutate()}
          syncing={syncMutation.isPending}
        />
      )}

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline">
          <Link to="/app/modelos">{canEdit ? "Cancelar" : "Voltar"}</Link>
        </Button>
        {canEdit && (
          <Button
            onClick={handleSubmit}
            disabled={isLocked || updateMutation.isPending}
          >
            <Save className="h-4 w-4" />
            {updateMutation.isPending ? "Salvando…" : "Salvar rascunho"}
          </Button>
        )}
        {canEdit && query.data.template_kind === "meta" && !isLocked && (
          <Button
            variant="default"
            onClick={() => submitMutation.mutate()}
            disabled={
              submitMutation.isPending ||
              ((form.meta_header_type === "image" ||
                form.meta_header_type === "video" ||
                form.meta_header_type === "document") &&
                !form.meta_header_handle)
            }
          >
            <Send className="h-4 w-4" />
            {submitMutation.isPending ? "Enviando…" : "Enviar para aprovação"}
          </Button>
        )}
      </div>
    </div>
  );
}

function statusLabel(s: string | null | undefined): string {
  switch (s) {
    case "submitted": return "Em análise";
    case "approved": return "Aprovado";
    case "rejected": return "Rejeitado";
    case "paused": return "Pausado";
    case "disabled": return "Desativado";
    case "error": return "Erro";
    default: return s ?? "—";
  }
}

function qualityBadgeClass(score: string | null | undefined): string {
  const s = String(score ?? "").toUpperCase();
  if (s === "GREEN") return "border-emerald-500/40 text-emerald-700 dark:text-emerald-300";
  if (s === "YELLOW") return "border-amber-500/40 text-amber-700 dark:text-amber-300";
  if (s === "RED") return "border-rose-500/40 text-rose-700 dark:text-rose-300";
  return "text-muted-foreground";
}

function MetaStatusPanel({
  template,
  onSync,
  syncing,
}: {
  template: MessageTemplate;
  onSync: () => void;
  syncing: boolean;
}) {
  const rec = template as unknown as {
    meta_status?: string | null;
    meta_status_raw?: string | null;
    meta_category?: string | null;
    meta_language?: string | null;
    meta_template_id?: string | null;
    meta_submitted_at?: string | null;
    meta_last_synced_at?: string | null;
    meta_last_webhook_at?: string | null;
    meta_rejection_reason?: string | null;
    meta_rejection_info?: { reason?: string | null } | null;
    meta_definition?: { quality_score?: { score?: string | null; date?: number | null } | null } | null;
  };
  const reason = rec.meta_rejection_reason ?? rec.meta_rejection_info?.reason ?? null;
  const quality = rec.meta_definition?.quality_score?.score ?? null;
  const fmt = (v: string | null | undefined) =>
    v ? new Date(v).toLocaleString("pt-BR") : "—";
  return (
    <section
      aria-label="Status na Meta"
      className="rounded-lg border bg-card p-4 text-sm space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Status:</span>
          <Badge variant="outline">{statusLabel(rec.meta_status)}</Badge>
          {rec.meta_status_raw && (
            <span className="text-xs text-muted-foreground">({rec.meta_status_raw})</span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={onSync} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando…" : "Atualizar status"}
        </Button>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
        {rec.meta_category && (
          <div className="flex gap-2"><dt className="text-muted-foreground">Categoria:</dt><dd>{rec.meta_category}</dd></div>
        )}
        {rec.meta_language && (
          <div className="flex gap-2"><dt className="text-muted-foreground">Idioma:</dt><dd>{rec.meta_language}</dd></div>
        )}
        {quality && (
          <div className="flex items-center gap-2">
            <dt className="text-muted-foreground">Qualidade:</dt>
            <dd><Badge variant="outline" className={qualityBadgeClass(quality)}>{quality}</Badge></dd>
          </div>
        )}
        {rec.meta_template_id && (
          <div className="flex gap-2"><dt className="text-muted-foreground">ID Meta:</dt><dd><code>{rec.meta_template_id}</code></dd></div>
        )}
        <div className="flex gap-2"><dt className="text-muted-foreground">Enviado em:</dt><dd>{fmt(rec.meta_submitted_at)}</dd></div>
        <div className="flex gap-2"><dt className="text-muted-foreground">Última sincronização:</dt><dd>{fmt(rec.meta_last_synced_at)}</dd></div>
        <div className="flex gap-2"><dt className="text-muted-foreground">Último webhook:</dt><dd>{fmt(rec.meta_last_webhook_at)}</dd></div>
      </dl>
      {rec.meta_status === "rejected" && reason && (
        <p className="rounded-md bg-destructive/5 p-2 text-xs text-destructive">
          <strong>Motivo da rejeição:</strong> {reason}
        </p>
      )}
      {rec.meta_status === "submitted" && (
        <p className="text-xs text-muted-foreground">
          A Meta costuma responder em minutos, podendo levar até 24h. Esta página atualiza automaticamente.
        </p>
      )}
    </section>
  );
}
