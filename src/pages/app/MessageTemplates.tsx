import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, BadgeCheck, MessagesSquare, Workflow, ShieldCheck } from "lucide-react";
import { TemplateCard } from "@/components/app/messages/TemplateCard";
import { UseTemplateDialog } from "@/components/app/messages/UseTemplateDialog";
import { MetaStatusDialog } from "@/components/app/messages/MetaStatusDialog";
import {
  META_STATUS_LABEL,
  TEMPLATE_CATEGORIES,
  type MessageTemplate,
  type MetaStatus,
} from "@/lib/templates";
import {
  useInstitutionIdentity,
  useInstitutionTemplateService,
} from "@/services/institutionTemplates";
import { qk } from "@/lib/queries";

const TYPE_OPTIONS: { value: "todos" | "internal" | "meta"; label: string }[] = [
  { value: "todos", label: "Todos os tipos" },
  { value: "internal", label: "Interno" },
  { value: "meta", label: "Meta" },
];

const STATUS_OPTIONS: { value: "todos" | MetaStatus; label: string }[] = [
  { value: "todos", label: "Todos os status" },
  { value: "not_submitted", label: "Rascunho" },
  { value: "submitted", label: META_STATUS_LABEL.submitted },
  { value: "approved", label: META_STATUS_LABEL.approved },
  { value: "rejected", label: META_STATUS_LABEL.rejected },
  { value: "paused", label: META_STATUS_LABEL.paused },
  { value: "disabled", label: META_STATUS_LABEL.disabled },
];

export default function MessageTemplates() {
  const identity = useInstitutionIdentity();
  const service = useInstitutionTemplateService();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const submitMutation = useMutation({
    mutationFn: (id: string) => service.submitToMeta(id),
    onMutate: (id) => setSubmittingId(id),
    onSettled: () => setSubmittingId(null),
    onSuccess: (r) => {
      toast.success(
        r.deduplicated
          ? "Modelo já havia sido enviado; status atualizado."
          : "Enviado para análise da Meta.",
      );
      qc.invalidateQueries({ queryKey: qk.institutionTemplates(identity.institution ?? "") });
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao enviar modelo."),
  });

  const knownCategories = new Set(TEMPLATE_CATEGORIES.map((c) => c.value));
  const initialCategoria = searchParams.get("categoria") ?? "todos";
  const initialCatFilter =
    initialCategoria === "todos" || knownCategories.has(initialCategoria)
      ? initialCategoria
      : "todos";

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"todos" | "internal" | "meta">("todos");
  const [statusFilter, setStatusFilter] = useState<"todos" | MetaStatus>("todos");
  const [catFilter, setCatFilter] = useState<string>(initialCatFilter);
  const [usingTpl, setUsingTpl] = useState<MessageTemplate | null>(null);
  const [useOpen, setUseOpen] = useState(false);
  const [statusTpl, setStatusTpl] = useState<MessageTemplate | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);

  const updateCatFilter = (value: string) => {
    setCatFilter(value);
    const next = new URLSearchParams(searchParams);
    if (value === "todos") next.delete("categoria");
    else next.set("categoria", value);
    setSearchParams(next, { replace: true });
  };

  const institution = identity.institution ?? "";

  const query = useQuery<MessageTemplate[]>({
    queryKey: qk.institutionTemplates(institution),
    queryFn: () => service.list(institution),
    enabled: !!institution,
  });

  const filtered = useMemo(() => {
    const rows = query.data ?? [];
    const needle = q.trim().toLowerCase();
    return rows.filter((t) => {
      if (typeFilter !== "todos" && t.template_kind !== typeFilter) return false;
      if (statusFilter !== "todos" && t.meta_status !== statusFilter) return false;
      if (catFilter !== "todos" && t.category !== catFilter) return false;
      if (!needle) return true;
      const hay = `${t.name ?? ""} ${t.description ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [query.data, q, typeFilter, statusFilter, catFilter]);

  const isLoading = identity.loading || (!!institution && query.isLoading);
  const loadError = identity.error ?? (query.error as Error | null);

  return (
    <div className="space-y-6">
      <header className="care-hero p-6 md:p-7">
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="care-chip"><BadgeCheck className="h-3.5 w-3.5 text-emerald-600" /> Biblioteca clínica + Meta</div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-brand">Modelos que já nascem prontos para cuidado, auditoria e WhatsApp.</h1>
            <p className="text-sm text-muted-foreground">
              Organize lembretes de consulta, preparo, educação em saúde e dados do médico em cards com status de aprovação, categoria e uso seguro em campanhas.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <span className="care-chip"><MessagesSquare className="h-3.5 w-3.5 text-primary" /> Conversa clara</span>
              <span className="care-chip"><Workflow className="h-3.5 w-3.5 text-primary" /> Variáveis controladas</span>
              <span className="care-chip"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Status Meta visível</span>
            </div>
          </div>
          {identity.isAdmin && (
            <Button asChild className="bg-brand text-brand-foreground hover:bg-brand/90">
              <Link to="/app/modelos/novo" aria-label="Novo modelo">
                <Plus className="h-4 w-4" /> Novo modelo
              </Link>
            </Button>
          )}
        </div>
      </header>

      <div className="care-card flex flex-wrap items-end gap-3 p-4">
        <div className="relative flex-1 min-w-[240px]">
          <label htmlFor="tpl-search" className="sr-only">Buscar modelo</label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="tpl-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome ou descrição"
            className="pl-9"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="tpl-type" className="text-xs text-muted-foreground">Tipo</label>
          <select
            id="tpl-type"
            aria-label="Tipo"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="tpl-status" className="text-xs text-muted-foreground">Status</label>
          <select
            id="tpl-status"
            aria-label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="tpl-cat" className="text-xs text-muted-foreground">Categoria</label>
          <select
            id="tpl-cat"
            aria-label="Categoria"
            value={catFilter}
            onChange={(e) => updateCatFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="todos">Todas as categorias</option>
            {TEMPLATE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <p className="font-medium">Não foi possível carregar os modelos.</p>
          <p className="mt-1 text-destructive/80">{loadError.message}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => query.refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {!loadError && isLoading && (
        <p className="text-sm text-muted-foreground">Carregando modelos…</p>
      )}

      {!loadError && !isLoading && filtered.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium text-foreground">Nenhum modelo encontrado.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajuste os filtros ou limpe a busca para ver todos os modelos da sua instituição.
          </p>
        </div>
      )}

      {!loadError && !isLoading && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((t) => {
            const isMeta = t.template_kind === "meta";
            let disabledReason: string | undefined;
            if (isMeta && t.meta_status !== "approved") {
              switch (t.meta_status) {
                case "submitted":
                  disabledReason = "Aguardando análise da Meta.";
                  break;
                case "rejected":
                  disabledReason = "Rejeitado — ver motivo no editor.";
                  break;
                case "paused":
                case "disabled":
                  disabledReason = "Indisponível.";
                  break;
                default:
                  disabledReason = "Ainda não submetido.";
              }
            }
            // Nota: divergência local (meta_has_local_differences) NÃO bloqueia o envio,
            // pois a Meta envia usando a versão aprovada por ela (via meta_template_name).
            // A divergência é apenas informativa (badge "Rodapé divergente" no card).
            return (
              <TemplateCard
                key={t.id}
                template={t}
                variant="catalog"
                useDisabledReason={disabledReason}
                onUse={() => {
                  setUsingTpl(t);
                  setUseOpen(true);
                }}
                onEdit={identity.isAdmin ? () => navigate(`/app/modelos/${t.id}`) : undefined}
                onOpenDetails={() => {
                  setStatusTpl(t);
                  setStatusOpen(true);
                }}
                onSubmitToMeta={
                  identity.isAdmin && isMeta &&
                  (t.meta_status === "not_submitted" ||
                    (t.meta_status as string) === "error")
                    ? () => submitMutation.mutate(t.id)
                    : undefined
                }
                submitting={submittingId === t.id}
              />
            );
          })}
        </div>
      )}

      <UseTemplateDialog
        open={useOpen}
        onOpenChange={(o) => {
          setUseOpen(o);
          if (!o) setUsingTpl(null);
        }}
        template={usingTpl}
        onGoToSegmented={(t) => navigate(`/app/conteudos/campanha?template=${t.id}`)}
      />

      <MetaStatusDialog
        template={statusTpl}
        open={statusOpen}
        onOpenChange={(o) => {
          setStatusOpen(o);
          if (!o) setStatusTpl(null);
        }}
      />
    </div>
  );
}