import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchers, qk } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, Search, Send, Trash2, X, ArrowLeft, ArrowRight,
  Pill, Utensils, Moon, Activity, Users, Stethoscope,
  HeartHandshake, BookOpen, Layers, FolderOpen, MessageSquare,
  Megaphone, MoreVertical,
} from "lucide-react";
import { z } from "zod";
import { SegmentFiltersForm } from "@/components/app/SegmentFilters";
import { RecipientPreview } from "@/components/app/RecipientPreview";
import { sendBatch } from "@/lib/whatsapp";
import {
  AudienceType, Recipient, SegmentDef, SegmentFilters,
  emptyFilters, resolveRecipients, resolveContentTargeting, TargetingMode,
  AUDIENCE_LABELS, ALL_AUDIENCES,
} from "@/lib/segments";
import { TemplateCard, StartBlankCard } from "@/components/app/messages/TemplateCard";
import { TemplateEditorDialog } from "@/components/app/messages/TemplateEditorDialog";
import { UseTemplateDialog } from "@/components/app/messages/UseTemplateDialog";
import type { MessageTemplate } from "@/lib/templates";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { useFolders, FALLBACK_FOLDER as FB_FOLDER, type FolderDef } from "@/hooks/useFolders";
import { NewFolderDialog } from "@/components/app/content/NewFolderDialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Folders (themes) — base set + custom user folders.
 * Helpers below read from a module-level reference updated by Content() via
 * useFolders(), so subcomponents can call them at render time without prop drilling.
 */
let CURRENT_FOLDERS: FolderDef[] = [];
let CURRENT_CATEGORIES: { value: string; label: string }[] = [];
const FALLBACK_FOLDER = FB_FOLDER;
const folderOf = (cat: string | null | undefined): string =>
  CURRENT_FOLDERS.find((f) => f.value === cat)?.value ?? FALLBACK_FOLDER;
const folderLabel = (cat: string | null | undefined): string =>
  CURRENT_FOLDERS.find((f) => f.value === cat)?.label ?? "Geral";

const AUDIENCES = [
  { value: "paciente", label: "Paciente" },
  { value: "familia", label: "Família" },
  { value: "cuidador", label: "Cuidadores" },
  { value: "ambos", label: "Todos" },
];

const contentSchema = z.object({
  title: z.string().trim().min(2).max(160),
  category: z.string().min(1),
  audience: z.string().min(1),
  body: z.string().trim().min(5).max(5000),
  targeting_mode: z.enum(["all", "audiences", "segment", "filters"]),
  audience_types: z.array(z.enum(["paciente", "familiar", "cuidador", "medico"])).default([]),
  segment_id: z.string().nullable().optional(),
  filters: z.any().optional(),
}).superRefine((v, ctx) => {
  if ((v.targeting_mode === "audiences" || v.targeting_mode === "filters") && v.audience_types.length === 0) {
    ctx.addIssue({ code: "custom", path: ["audience_types"], message: "Selecione ao menos um tipo de público" });
  }
  if (v.targeting_mode === "segment" && !v.segment_id) {
    ctx.addIssue({ code: "custom", path: ["segment_id"], message: "Selecione um segmento" });
  }
});

type ContentRow = {
  id: string; title: string; category: string; audience: string; body: string;
  targeting_mode?: TargetingMode | null;
  audience_types?: AudienceType[] | null;
  segment_id?: string | null;
  filters?: SegmentFilters | null;
};

const labelOf = (arr: { value: string; label: string }[], v: string) =>
  arr.find((x) => x.value === v)?.label ?? v;

function describeTargeting(c: ContentRow, segments: SegmentDef[]): string {
  const mode = c.targeting_mode ?? "all";
  if (mode === "all") return "Todos os públicos";
  if (mode === "audiences") {
    const list = (c.audience_types ?? []).map((a) => AUDIENCE_LABELS[a]);
    return list.length ? list.join(" + ") : "Tipos de público";
  }
  if (mode === "segment") {
    const seg = segments.find((s) => s.id === c.segment_id);
    return seg ? `Segmento: ${seg.name}` : "Segmento removido";
  }
  const aud = (c.audience_types ?? []).map((a) => AUDIENCE_LABELS[a]).join("+") || "público";
  return `Filtros personalizados (${aud})`;
}

export default function Content() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const activeFolder = params.get("pasta");
  const { data: items = [] } = useQuery({ queryKey: qk.content, queryFn: fetchers.content });
  const { data: segments = [] } = useQuery<SegmentDef[]>({
    queryKey: qk.segments,
    queryFn: fetchers.segments as () => Promise<SegmentDef[]>,
  });
  const { data: templates = [] } = useQuery<MessageTemplate[]>({
    queryKey: qk.templates,
    queryFn: fetchers.templates as () => Promise<MessageTemplate[]>,
  });

  const [q, setQ] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaultCategory, setCreateDefaultCategory] = useState<string | undefined>();
  const [editItem, setEditItem] = useState<ContentRow | null>(null);
  const [sendItem, setSendItem] = useState<ContentRow | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);

  // Merged folders (base + custom) — also kept on a module-level ref so
  // descendant components can use folderOf/folderLabel without prop drilling.
  const { folders, categories } = useFolders();
  CURRENT_FOLDERS = folders;
  CURRENT_CATEGORIES = categories;

  const allContent = items as ContentRow[];
  const activeTemplates = useMemo(
    () => (templates as MessageTemplate[]).filter((t) => t.is_active),
    [templates],
  );

  // Counts per folder (templates + content)
  const folderCounts = useMemo(() => {
    const tplByFolder = new Map<string, number>();
    for (const t of activeTemplates) {
      const k = folderOf(t.category);
      tplByFolder.set(k, (tplByFolder.get(k) ?? 0) + 1);
    }
    const ctByFolder = new Map<string, number>();
    for (const c of allContent) {
      const k = folderOf(c.category);
      ctByFolder.set(k, (ctByFolder.get(k) ?? 0) + 1);
    }
    return folders.map((f) => ({
      ...f,
      templates: tplByFolder.get(f.value) ?? 0,
      contents: ctByFolder.get(f.value) ?? 0,
      total: (tplByFolder.get(f.value) ?? 0) + (ctByFolder.get(f.value) ?? 0),
    }));
  }, [activeTemplates, allContent, folders]);

  // Global search across folders
  const searchTerm = q.trim().toLowerCase();
  const globalResults = useMemo(() => {
    if (!searchTerm) return null;
    const tpls = activeTemplates.filter(
      (t) =>
        t.name.toLowerCase().includes(searchTerm) ||
        t.body.toLowerCase().includes(searchTerm) ||
        (t.description ?? "").toLowerCase().includes(searchTerm),
    );
    const cts = allContent.filter(
      (c) =>
        c.title.toLowerCase().includes(searchTerm) ||
        c.body.toLowerCase().includes(searchTerm),
    );
    return { tpls, cts };
  }, [searchTerm, activeTemplates, allContent]);

  // Folder detail view
  if (activeFolder) {
    const folder = folders.find((f) => f.value === activeFolder)
      ?? folders[folders.length - 1];
    if (!folder) return null;
    const folderTemplates = activeTemplates.filter((t) => folderOf(t.category) === folder.value);
    const folderContents = allContent.filter((c) => folderOf(c.category) === folder.value);

    return (
      <FolderDetail
        folder={folder}
        templates={folderTemplates}
        contents={folderContents}
        onBack={() => setParams({})}
        onNewContent={() => { setCreateDefaultCategory(folder.value); setCreateOpen(true); }}
        onEditContent={(c) => setEditItem(c)}
        onSendContent={(c) => setSendItem(c)}
        onContentSaved={() => queryClient.invalidateQueries({ queryKey: qk.content })}
        onContentSent={() => queryClient.invalidateQueries({ queryKey: qk.messages })}
        createOpen={createOpen}
        setCreateOpen={setCreateOpen}
        createDefaultCategory={createDefaultCategory}
        editItem={editItem}
        setEditItem={setEditItem}
        sendItem={sendItem}
        setSendItem={setSendItem}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand">Conteúdos educativos</h1>
          <p className="text-muted-foreground mt-1">
            Objetivos de mensagem e materiais educativos organizados por tema. Abra uma pasta para enviar ou gerenciar conteúdos daquele tema.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/app/conteudos/campanha">
              <Megaphone className="h-4 w-4" /> Disparar mensagem
            </Link>
          </Button>
          <Button variant="hero" onClick={() => setNewFolderOpen(true)}>
            <Plus className="h-4 w-4" /> Novo conteúdo
          </Button>
        </div>
      </header>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar em todas as pastas (objetivos e conteúdos)..."
            className="pl-9 w-full"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {globalResults ? (
        <SearchResults
          templates={globalResults.tpls}
          contents={globalResults.cts}
          onOpenFolder={(cat) => setParams({ pasta: cat })}
          onEditContent={(c) => setEditItem(c)}
          onSendContent={(c) => setSendItem(c)}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {folderCounts.map((f) => {
            const Icon = f.icon;
            const isCustom = (f as FolderDef).isCustom;
            const folderId = (f as FolderDef).id;
            return (
              <div
                key={f.value}
                className="group relative flex flex-col rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-soft"
              >
                {isCustom && folderId && (
                  <div className="absolute right-2 top-2 z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Opções da pasta"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!confirm(`Excluir a pasta "${f.label}"? Objetivos e conteúdos dentro dela permanecerão, mas voltarão à pasta Geral.`)) return;
                            const { error } = await supabase.from("content_folders").delete().eq("id", folderId);
                            if (error) return toast.error(error.message);
                            toast.success("Pasta excluída");
                            queryClient.invalidateQueries({ queryKey: ["content-folders"] });
                          }}
                        >
                          <Trash2 className="h-4 w-4" /> Excluir pasta
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setParams({ pasta: f.value })}
                  className="text-left flex flex-col flex-1"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 text-brand flex items-center justify-center shrink-0 transition-colors group-hover:bg-primary/20">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1 pr-6">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-lg font-bold text-brand line-clamp-1">{f.label}</h3>
                        {isCustom && (
                          <Badge variant="secondary" className="text-[10px] uppercase">Personalizada</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{f.description}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-border text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5 text-brand" />
                      <span className="tabular-nums font-medium">{f.templates}</span> modelo{f.templates === 1 ? "" : "s"}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1 text-brand font-medium opacity-0 transition-opacity group-hover:opacity-100">
                      Abrir <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <ContentFormDialog
        open={createOpen}
        onOpenChange={(o) => { setCreateOpen(o); if (!o) setCreateDefaultCategory(undefined); }}
        defaultCategory={createDefaultCategory}
        onSaved={() => queryClient.invalidateQueries({ queryKey: qk.content })}
      />
      <ContentFormDialog
        open={!!editItem}
        onOpenChange={(v) => !v && setEditItem(null)}
        initial={editItem ?? undefined}
        onSaved={() => queryClient.invalidateQueries({ queryKey: qk.content })}
      />
      <SendContentDialog
        item={sendItem}
        onOpenChange={(v) => !v && setSendItem(null)}
        onSent={() => queryClient.invalidateQueries({ queryKey: qk.messages })}
      />
      <NewFolderDialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        onCreated={(slug) => setParams({ pasta: slug })}
      />
    </div>
  );
}

/** Search results across all folders. */
function SearchResults({
  templates, contents, onOpenFolder, onEditContent, onSendContent,
}: {
  templates: MessageTemplate[];
  contents: ContentRow[];
  onOpenFolder: (cat: string) => void;
  onEditContent: (c: ContentRow) => void;
  onSendContent: (c: ContentRow) => void;
}) {
  if (!templates.length && !contents.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
        Nenhum resultado para sua busca.
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {templates.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Objetivos · {templates.length}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {templates.map((t) => (
              <div key={t.id}>
                <button
                  type="button"
                  onClick={() => onOpenFolder(folderOf(t.category))}
                  className="mb-1 text-[10px] uppercase tracking-wide text-brand hover:underline inline-flex items-center gap-1"
                >
                  <FolderOpen className="h-3 w-3" /> {folderLabel(folderOf(t.category))}
                </button>
                <TemplateCard
                  template={t}
                  onUse={() => onOpenFolder(folderOf(t.category))}
                  onEdit={() => onOpenFolder(folderOf(t.category))}
                  onDuplicate={() => onOpenFolder(folderOf(t.category))}
                />
              </div>
            ))}
          </div>
        </section>
      )}
      {contents.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Conteúdos · {contents.length}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {contents.map((c) => (
              <article
                key={c.id}
                onClick={() => onEditContent(c)}
                className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-soft cursor-pointer"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOpenFolder(folderOf(c.category)); }}
                    className="text-[10px] uppercase tracking-wide text-brand hover:underline inline-flex items-center gap-1"
                  >
                    <FolderOpen className="h-3 w-3" /> {folderLabel(folderOf(c.category))}
                  </button>
                </div>
                <h3 className="mt-2 font-display text-lg font-bold text-brand line-clamp-2">{c.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-3 flex-1">{c.body}</p>
                <div className="mt-4 flex items-center gap-2 pt-3 border-t border-border">
                  <Button variant="hero" size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); onSendContent(c); }}>
                    <Send className="h-4 w-4" /> Enviar
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Folder detail: templates + content for one theme. */
function FolderDetail({
  folder, templates, contents, onBack,
  onNewContent, onEditContent, onSendContent,
  onContentSaved, onContentSent,
  createOpen, setCreateOpen, createDefaultCategory,
  editItem, setEditItem, sendItem, setSendItem,
}: {
  folder: FolderDef;
  templates: MessageTemplate[];
  contents: ContentRow[];
  onBack: () => void;
  onNewContent: () => void;
  onEditContent: (c: ContentRow) => void;
  onSendContent: (c: ContentRow) => void;
  onContentSaved: () => void;
  onContentSent: () => void;
  createOpen: boolean;
  setCreateOpen: (o: boolean) => void;
  createDefaultCategory?: string;
  editItem: ContentRow | null;
  setEditItem: (c: ContentRow | null) => void;
  sendItem: ContentRow | null;
  setSendItem: (c: ContentRow | null) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const Icon = folder.icon;

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTpl, setEditingTpl] = useState<MessageTemplate | null>(null);
  const [useOpen, setUseOpen] = useState(false);
  const [usingTpl, setUsingTpl] = useState<MessageTemplate | null>(null);

  const duplicateTpl = async (t: MessageTemplate) => {
    let institution = "";
    if (user) {
      const { data } = await supabase.from("profiles").select("institution").eq("id", user.id).maybeSingle();
      institution = data?.institution ?? "";
    }
    const { error } = await supabase.from("message_templates").insert({
      name: `${t.name} (cópia)`,
      description: t.description,
      category: t.category,
      body: t.body,
      body_patient: t.body_patient ?? t.body,
      body_contact: t.body_contact ?? null,
      body_segment: t.body_segment ?? null,
      variables: t.variables,
      template_kind: "internal",
      meta_language: t.meta_language,
      channel: "whatsapp",
      targeting_mode: t.targeting_mode,
      audience_types: t.audience_types,
      filters: t.filters,
      created_by: user!.id,
      institution,
      is_default: false,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Objetivo duplicado");
    qc.invalidateQueries({ queryKey: qk.templates });
  };

  const sortedTemplates = useMemo(() => {
    return [...templates].sort((a, b) => {
      const ad = a.is_default ? 1 : 0;
      const bd = b.is_default ? 1 : 0;
      if (ad !== bd) return bd - ad;
      return a.name.localeCompare(b.name);
    });
  }, [templates]);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
          <ArrowLeft className="h-4 w-4" /> Voltar para pastas
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-12 w-12 rounded-xl bg-primary/10 text-brand flex items-center justify-center shrink-0">
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Conteúdos / <span className="font-medium text-brand">{folder.label}</span></div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand mt-0.5">{folder.label}</h1>
              <p className="text-muted-foreground text-sm mt-1 max-w-2xl">{folder.description}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Templates section */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-brand inline-flex items-center gap-2">
            Objetivos de mensagem
            <span className="text-xs font-normal text-muted-foreground">({sortedTemplates.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            <Link
              to="/app/modelos"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-brand hover:underline"
            >
              Ver todos os modelos
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setEditingTpl(null); setEditorOpen(true); }}
            >
              <Plus className="h-4 w-4" /> Novo objetivo
            </Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <StartBlankCard onClick={() => { setEditingTpl(null); setEditorOpen(true); }} />
          {sortedTemplates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onUse={() => { setUsingTpl(t); setUseOpen(true); }}
              onEdit={() => { setEditingTpl(t); setEditorOpen(true); }}
              onDuplicate={() => duplicateTpl(t)}
            />
          ))}
        </div>
        {sortedTemplates.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Nenhum objetivo nesta pasta ainda. Clique em <strong className="text-brand">Novo objetivo</strong> para criar.
          </div>
        )}
      </section>

      {/* Educational content section */}
      {/* Template dialogs */}
      <TemplateEditorDialog
        open={editorOpen}
        onOpenChange={(o) => { setEditorOpen(o); if (!o) setEditingTpl(null); }}
        editing={editingTpl}
        defaultCategory={folder.value}
        onSavedUse={(t) => { setUsingTpl(t); setUseOpen(true); }}
      />
      <UseTemplateDialog
        open={useOpen}
        onOpenChange={(o) => { setUseOpen(o); if (!o) setUsingTpl(null); }}
        template={usingTpl}
        onGoToSegmented={(t) => navigate(`/app/conteudos/campanha?template=${t.id}`)}
      />

      {/* Content dialogs */}
      <ContentFormDialog
        open={createOpen}
        onOpenChange={(o) => setCreateOpen(o)}
        defaultCategory={createDefaultCategory ?? folder.value}
        onSaved={onContentSaved}
      />
      <ContentFormDialog
        open={!!editItem}
        onOpenChange={(v) => !v && setEditItem(null)}
        initial={editItem ?? undefined}
        onSaved={onContentSaved}
      />
      <SendContentDialog
        item={sendItem}
        onOpenChange={(v) => !v && setSendItem(null)}
        onSent={onContentSent}
      />
    </div>
  );
}

function ContentFormDialog({
  open, onOpenChange, initial, onSaved, defaultCategory,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: ContentRow;
  onSaved: () => void;
  defaultCategory?: string;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    title: "",
    category: "medicacao",
    audience: "ambos",
    body: "",
    targeting_mode: "all" as TargetingMode,
    audience_types: [] as AudienceType[],
    segment_id: null as string | null,
    filters: emptyFilters(),
  });
  const [saving, setSaving] = useState(false);
  const [previewKeys, setPreviewKeys] = useState<Set<string>>(new Set());

  const { data: segments = [] } = useQuery<SegmentDef[]>({
    queryKey: qk.segments,
    queryFn: fetchers.segments as () => Promise<SegmentDef[]>,
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setForm({
        title: initial?.title ?? "",
        category: initial?.category ?? defaultCategory ?? "medicacao",
        audience: initial?.audience ?? "ambos",
        body: initial?.body ?? "",
        targeting_mode: (initial?.targeting_mode ?? "all") as TargetingMode,
        audience_types: (initial?.audience_types ?? []) as AudienceType[],
        segment_id: initial?.segment_id ?? null,
        filters: { ...emptyFilters(), ...(initial?.filters ?? {}) },
      });
      setPreviewKeys(new Set());
    }
  }, [open, initial, defaultCategory]);

  const parsed = contentSchema.safeParse(form);
  const valid = parsed.success;

  // Live recipient preview
  const previewAudiences = useMemo<AudienceType[]>(() => {
    if (form.targeting_mode === "all") return ALL_AUDIENCES;
    if (form.targeting_mode === "audiences" || form.targeting_mode === "filters") return form.audience_types;
    if (form.targeting_mode === "segment") {
      const s = (segments as SegmentDef[]).find((x) => x.id === form.segment_id);
      return (s?.audience_types ?? []) as AudienceType[];
    }
    return [];
  }, [form, segments]);
  const previewFilters = useMemo<SegmentFilters>(() => {
    if (form.targeting_mode === "filters") return form.filters;
    if (form.targeting_mode === "segment") {
      const s = (segments as SegmentDef[]).find((x) => x.id === form.segment_id);
      return (s?.filters ?? emptyFilters()) as SegmentFilters;
    }
    return emptyFilters();
  }, [form, segments]);

  const { data: previewRecipients = [], isLoading: previewLoading } = useQuery<Recipient[]>({
    queryKey: ["content-targeting-preview", previewAudiences, previewFilters],
    queryFn: () => resolveRecipients(previewAudiences, previewFilters),
    enabled: open && previewAudiences.length > 0,
  });

  const save = async () => {
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Verifique os campos");
    setSaving(true);
    // Derive legacy `audience` for back-compat
    const aud = form.targeting_mode === "all"
      ? "ambos"
      : form.audience_types.length === 1
        ? (form.audience_types[0] === "familiar" ? "familia" : form.audience_types[0])
        : "ambos";
    const payload = {
      title: form.title.trim(),
      category: form.category,
      audience: aud,
      body: form.body.trim(),
      targeting_mode: form.targeting_mode,
      audience_types: form.targeting_mode === "all" ? [] : form.audience_types,
      segment_id: form.targeting_mode === "segment" ? form.segment_id : null,
      filters: form.targeting_mode === "filters" ? form.filters : {},
    };
    const { error } = isEdit
      ? await supabase.from("content_library").update(payload as any).eq("id", initial!.id)
      : await supabase.from("content_library").insert(payload as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isEdit ? "Conteúdo atualizado" : "Conteúdo adicionado");
    onOpenChange(false);
    onSaved();
  };

  const remove = async () => {
    if (!initial) return;
    if (!confirm("Excluir este conteúdo?")) return;
    const { error } = await supabase.from("content_library").delete().eq("id", initial.id);
    if (error) return toast.error(error.message);
    toast.success("Conteúdo excluído");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar conteúdo" : "Adicionar conteúdo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Como tomar o medicamento corretamente"
            />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENT_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Conteúdo</Label>
            <Textarea
              rows={6}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Escreva a orientação completa..."
            />
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
            <div className="space-y-1">
              <Label className="text-sm font-semibold text-brand">Segmentação</Label>
              <p className="text-xs text-muted-foreground">Direcione este conteúdo para o público certo.</p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { v: "all", label: "Todos" },
                { v: "audiences", label: "Tipos de público" },
                { v: "segment", label: "Segmento salvo" },
                { v: "filters", label: "Filtros personalizados" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setForm({ ...form, targeting_mode: opt.v as TargetingMode })}
                  className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                    form.targeting_mode === opt.v
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {form.targeting_mode === "audiences" && (
              <div className="space-y-2">
                <Label>Tipos de público</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(Object.keys(AUDIENCE_LABELS) as AudienceType[]).map((a) => (
                    <label key={a} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-sm cursor-pointer hover:bg-muted/50">
                      <Checkbox
                        checked={form.audience_types.includes(a)}
                        onCheckedChange={(v) =>
                          setForm({
                            ...form,
                            audience_types: v
                              ? Array.from(new Set([...form.audience_types, a]))
                              : form.audience_types.filter((x) => x !== a),
                          })
                        }
                      />
                      <span>{AUDIENCE_LABELS[a]}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {form.targeting_mode === "segment" && (
              <div className="space-y-2">
                <Label>Segmento</Label>
                <Select
                  value={form.segment_id ?? ""}
                  onValueChange={(v) => setForm({ ...form, segment_id: v || null })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione um segmento" /></SelectTrigger>
                  <SelectContent>
                    {(segments as SegmentDef[]).length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Nenhum segmento salvo. Crie em Segmentos.
                      </div>
                    ) : (
                      (segments as SegmentDef[]).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <a
                  href="/app/segmentos"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-xs text-brand hover:underline"
                >
                  Criar novo segmento →
                </a>
              </div>
            )}

            {form.targeting_mode === "filters" && (
              <SegmentFiltersForm
                filters={form.filters}
                onFiltersChange={(f) => setForm({ ...form, filters: f })}
              />
            )}

            {form.targeting_mode !== "all" && previewAudiences.length > 0 && (
              <RecipientPreview
                recipients={previewRecipients}
                loading={previewLoading}
                selectedKeys={previewKeys}
                onChange={setPreviewKeys}
                readOnly
              />
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          {isEdit && (
            <Button variant="destructive" onClick={remove} className="mr-auto">
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="hero" onClick={save} disabled={!valid || saving}>
            {isEdit ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SendContentDialog({
  item, onOpenChange, onSent,
}: {
  item: ContentRow | null;
  onOpenChange: (v: boolean) => void;
  onSent: () => void;
}) {
  const open = !!item;
  const [mode, setMode] = useState<"bulk" | "single" | "segment">("bulk");
  const [patientId, setPatientId] = useState<string>("");
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [sendToPatient, setSendToPatient] = useState(true);
  const [selectedContacts, setSelectedContacts] = useState<Record<string, boolean>>({});
  const [bulkGroups, setBulkGroups] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);
  // Segment mode
  const [segMode, setSegMode] = useState<"saved" | "adhoc">("saved");
  const [savedSegmentId, setSavedSegmentId] = useState<string>("");
  const [adhocAudiences, setAdhocAudiences] = useState<AudienceType[]>(["paciente"]);
  const [adhocFilters, setAdhocFilters] = useState<SegmentFilters>(emptyFilters());
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [channelOverride, setChannelOverride] = useState<"auto" | "whatsapp" | "sms">("auto");

  useEffect(() => {
    if (open) {
      const tmode = (item?.targeting_mode ?? "all") as TargetingMode;
      const aud = item?.audience ?? "ambos";
      // Decide initial dialog mode based on content's targeting
      const initialMode: "bulk" | "single" | "segment" =
        tmode === "segment" || tmode === "filters" ? "segment" : "bulk";
      setMode(initialMode);
      setPatientId("");
      setChannel("whatsapp");
      setSendToPatient(true);
      setSelectedContacts({});
      // Bulk groups: from audience_types when present, else legacy audience
      const at = (item?.audience_types ?? []) as AudienceType[];
      if (tmode === "audiences" && at.length) {
        setBulkGroups({
          paciente: at.includes("paciente"),
          familiar: at.includes("familiar"),
          cuidador: at.includes("cuidador"),
          medico: at.includes("medico"),
        });
      } else {
        setBulkGroups({
          paciente: aud === "paciente" || aud === "ambos",
          familiar: aud === "familia" || aud === "ambos",
          cuidador: aud === "cuidador" || aud === "ambos",
          medico: false,
        });
      }
      // Segment mode pre-load
      if (tmode === "segment" && item?.segment_id) {
        setSegMode("saved");
        setSavedSegmentId(item.segment_id);
        setAdhocAudiences(["paciente"]);
        setAdhocFilters(emptyFilters());
      } else if (tmode === "filters") {
        setSegMode("adhoc");
        setSavedSegmentId("");
        setAdhocAudiences((item?.audience_types ?? ["paciente"]) as AudienceType[]);
        setAdhocFilters({ ...emptyFilters(), ...(item?.filters ?? {}) });
      } else {
        setSegMode("saved");
        setSavedSegmentId("");
        setAdhocAudiences(["paciente"]);
        setAdhocFilters(emptyFilters());
      }
      setChannelOverride("auto");
      setSelectedKeys(new Set());
    }
  }, [open, item]);

  const { data: patients = [] } = useQuery({
    queryKey: qk.patients,
    queryFn: fetchers.patients,
    enabled: open,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", patientId],
    enabled: open && !!patientId,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, full_name, phone, relation, channel_pref")
        .eq("patient_id", patientId);
      return data ?? [];
    },
  });

  // For bulk: load all contacts across all patients (RLS scopes to institution)
  const { data: allContacts = [] } = useQuery({
    queryKey: ["all-contacts"],
    enabled: open && mode === "bulk",
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, patient_id, relation");
      return data ?? [];
    },
  });

  const { data: savedSegments = [] } = useQuery<SegmentDef[]>({
    queryKey: qk.segments,
    queryFn: fetchers.segments as () => Promise<SegmentDef[]>,
    enabled: open && mode === "segment",
  });

  const activeSegment = mode === "segment" && segMode === "saved"
    ? (savedSegments as SegmentDef[]).find((s) => s.id === savedSegmentId) ?? null
    : null;
  const activeAudiences = mode === "segment"
    ? (segMode === "saved" ? (activeSegment?.audience_types ?? []) : adhocAudiences)
    : [];
  const activeFilters = mode === "segment"
    ? (segMode === "saved" ? (activeSegment?.filters ?? emptyFilters()) : adhocFilters)
    : emptyFilters();

  const { data: segmentRecipients = [], isLoading: segLoading } = useQuery<Recipient[]>({
    queryKey: ["segment-resolve-send", activeAudiences, activeFilters],
    queryFn: () => resolveRecipients(activeAudiences, activeFilters),
    enabled: open && mode === "segment" && activeAudiences.length > 0,
  });

  const selectedContactIds = Object.entries(selectedContacts).filter(([, v]) => v).map(([k]) => k);

  const bulkPreview = useMemo(() => {
    if (mode !== "bulk") return { patients: 0, contacts: 0, total: 0 };
    const pCount = bulkGroups.paciente ? (patients as any[]).length : 0;
    const relations = ["familiar", "cuidador", "medico"].filter((r) => bulkGroups[r]);
    const cCount = (allContacts as any[]).filter((c) => relations.includes(c.relation)).length;
    return { patients: pCount, contacts: cCount, total: pCount + cCount };
  }, [mode, bulkGroups, patients, allContacts]);

  const canSend = mode === "single"
    ? !!patientId && (sendToPatient || selectedContactIds.length > 0)
    : mode === "segment"
      ? selectedKeys.size > 0
      : bulkPreview.total > 0;

  const send = async () => {
    if (!item || !canSend) return;
    setSending(true);
    const body = `${item.title}\n\n${item.body}`;
    const now = new Date().toISOString();
    const rows: any[] = [];

    if (mode === "single") {
      if (sendToPatient) {
        rows.push({ patient_id: patientId, channel, direction: "outbound", body, status: "queued", queued_at: now, message_type: "content_broadcast" });
      }
      for (const cid of selectedContactIds) {
        rows.push({ patient_id: patientId, contact_id: cid, channel, direction: "outbound", body, status: "queued", queued_at: now, message_type: "content_broadcast" });
      }
    } else if (mode === "bulk") {
      if (bulkGroups.paciente) {
        for (const p of patients as any[]) {
          rows.push({ patient_id: p.id, channel, direction: "outbound", body, status: "queued", queued_at: now, message_type: "content_broadcast" });
        }
      }
      const relations = ["familiar", "cuidador", "medico"].filter((r) => bulkGroups[r]);
      for (const c of allContacts as any[]) {
        if (relations.includes(c.relation)) {
          rows.push({ patient_id: c.patient_id, contact_id: c.id, channel, direction: "outbound", body, status: "queued", queued_at: now, message_type: "content_broadcast" });
        }
      }
    } else {
      // segment mode
      for (const r of segmentRecipients) {
        if (!selectedKeys.has(r.key)) continue;
        rows.push({
          patient_id: r.patient_id,
          contact_id: r.contact_id ?? null,
          channel: channelOverride === "auto" ? r.channel : channelOverride,
          direction: "outbound",
          body,
          status: "queued",
          queued_at: now,
          message_type: "content_broadcast",
        });
      }
    }

    if (rows.length === 0) { setSending(false); return; }
    const { data: inserted, error } = await supabase
      .from("messages")
      .insert(rows)
      .select("id, channel");
    if (error) {
      setSending(false);
      return toast.error(error.message);
    }

    const whatsappIds = (inserted ?? [])
      .filter((r: any) => r.channel === "whatsapp")
      .map((r: any) => r.id as string);
    const otherCount = (inserted?.length ?? 0) - whatsappIds.length;

    let okCount = 0;
    let failCount = 0;
    if (whatsappIds.length > 0) {
      const res = await sendBatch(whatsappIds, 3);
      okCount = res.ok;
      failCount = res.failed;
    }
    setSending(false);

    if (failCount === 0) {
      toast.success(
        `Conteúdo enviado (${okCount + otherCount} ${okCount + otherCount === 1 ? "destinatário" : "destinatários"})`,
      );
    } else {
      toast.error(`Enviadas: ${okCount} · Falhas: ${failCount}${otherCount ? ` · Pendentes (SMS): ${otherCount}` : ""}`);
    }
    onOpenChange(false);
    onSent();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar conteúdo</DialogTitle>
        </DialogHeader>
        {item && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="text-sm font-semibold text-brand">{item.title}</div>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{item.body}</p>
            </div>

            <div className="flex gap-1 rounded-lg border border-border p-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => setMode("bulk")}
                className={`flex-1 whitespace-nowrap rounded-md py-2 px-2 text-xs sm:text-sm font-medium transition-colors ${mode === "bulk" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                Por grupo
              </button>
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`flex-1 whitespace-nowrap rounded-md py-2 px-2 text-xs sm:text-sm font-medium transition-colors ${mode === "single" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                Paciente específico
              </button>
              <button
                type="button"
                onClick={() => setMode("segment")}
                className={`flex-1 whitespace-nowrap rounded-md py-2 px-2 text-xs sm:text-sm font-medium transition-colors ${mode === "segment" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                Segmentado
              </button>
            </div>

            {mode === "segment" ? (
              <div className="space-y-4">
                <div className="flex gap-1 rounded-lg border border-border p-1">
                  <button
                    type="button"
                    onClick={() => setSegMode("saved")}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${segMode === "saved" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    Usar segmento salvo
                  </button>
                  <button
                    type="button"
                    onClick={() => setSegMode("adhoc")}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${segMode === "adhoc" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    Montar filtros agora
                  </button>
                </div>

                {segMode === "saved" ? (
                  <div className="space-y-2">
                    <Label>Segmento</Label>
                    <Select value={savedSegmentId} onValueChange={setSavedSegmentId}>
                      <SelectTrigger><SelectValue placeholder="Selecione um segmento" /></SelectTrigger>
                      <SelectContent>
                        {(savedSegments as SegmentDef[]).length === 0 ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum segmento salvo. Crie em Segmentos.</div>
                        ) : (
                          (savedSegments as SegmentDef[]).map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {activeSegment?.description && (
                      <p className="text-xs text-muted-foreground">{activeSegment.description}</p>
                    )}
                  </div>
                ) : (
                  <SegmentFiltersForm
                    filters={adhocFilters}
                    onFiltersChange={setAdhocFilters}
                  />
                )}

                {activeAudiences.length > 0 && (
                  <RecipientPreview
                    recipients={segmentRecipients}
                    loading={segLoading}
                    selectedKeys={selectedKeys}
                    onChange={setSelectedKeys}
                  />
                )}

                <div className="space-y-2">
                  <Label>Canal de envio</Label>
                  <Select value={channelOverride} onValueChange={(v) => setChannelOverride(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Canal preferido de cada destinatário</SelectItem>
                      <SelectItem value="whatsapp">Forçar WhatsApp</SelectItem>
                      <SelectItem value="sms">Forçar SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : mode === "bulk" ? (
              <div className="space-y-2">
                <Label>Para quem enviar</Label>
                <div className="space-y-2 rounded-lg border border-border p-3">
                  {[
                    { key: "paciente", label: "Todos os pacientes" },
                    { key: "familiar", label: "Todos os familiares" },
                    { key: "cuidador", label: "Todos os cuidadores" },
                    { key: "medico", label: "Todos os médicos" },
                  ].map((g) => (
                    <label key={g.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={!!bulkGroups[g.key]}
                        onCheckedChange={(v) => setBulkGroups((s) => ({ ...s, [g.key]: !!v }))}
                      />
                      <span>{g.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {bulkPreview.total > 0
                    ? `Será enviado para ${bulkPreview.total} ${bulkPreview.total === 1 ? "destinatário" : "destinatários"}.`
                    : "Selecione ao menos um grupo."}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Paciente</Label>
                  <Select value={patientId} onValueChange={setPatientId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                    <SelectContent>
                      {(patients as any[]).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {patientId && (
                  <div className="space-y-2">
                    <Label>Para quem enviar</Label>
                    <div className="space-y-2 rounded-lg border border-border p-3">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={sendToPatient} onCheckedChange={(v) => setSendToPatient(!!v)} />
                        <span>Paciente</span>
                      </label>
                      {(contacts as any[]).map((c) => (
                        <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={!!selectedContacts[c.id]}
                            onCheckedChange={(v) =>
                              setSelectedContacts((s) => ({ ...s, [c.id]: !!v }))
                            }
                          />
                          <span>{c.full_name} <span className="text-muted-foreground">· {c.relation}</span></span>
                        </label>
                      ))}
                      {contacts.length === 0 && (
                        <p className="text-xs text-muted-foreground">Nenhum contato cadastrado para este paciente.</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {mode !== "segment" && (
              <div className="space-y-2">
                <Label>Canal</Label>
                <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="hero" onClick={send} disabled={!canSend || sending}>
            <Send className="h-4 w-4" /> Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}