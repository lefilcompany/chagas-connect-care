import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchers, qk } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { type MessageTemplate } from "@/lib/templates";
import { useFolders } from "@/hooks/useFolders";
import { StartBlankCard, TemplateCard } from "./TemplateCard";
import { TemplateEditorDialog } from "./TemplateEditorDialog";
import { UseTemplateDialog } from "./UseTemplateDialog";

export default function TemplatesTab({
  onGoToSegmented,
}: {
  onGoToSegmented?: (template: MessageTemplate) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { categories: folderCategories } = useFolders();
  const { data: templates = [] } = useQuery<MessageTemplate[]>({
    queryKey: qk.templates,
    queryFn: fetchers.templates as () => Promise<MessageTemplate[]>,
  });

  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("todos");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);

  const [useOpen, setUseOpen] = useState(false);
  const [usingTpl, setUsingTpl] = useState<MessageTemplate | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return templates.filter((t) => {
      if (!t.is_active) return false;
      if (catFilter !== "todos" && t.category !== catFilter) return false;
      if (!term) return true;
      return (
        t.name.toLowerCase().includes(term) ||
        t.body.toLowerCase().includes(term) ||
        (t.description ?? "").toLowerCase().includes(term)
      );
    });
  }, [templates, q, catFilter]);

  // Defaults first, then user templates
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const ad = a.is_default ? 1 : 0;
      const bd = b.is_default ? 1 : 0;
      if (ad !== bd) return bd - ad;
      return a.name.localeCompare(b.name);
    });
  }, [filtered]);

  const duplicate = async (t: MessageTemplate) => {
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

  const openUse = (t: MessageTemplate) => {
    setUsingTpl(t);
    setUseOpen(true);
  };

  const openEdit = (t: MessageTemplate | null) => {
    setEditing(t);
    setEditorOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-3 grid gap-2 sm:grid-cols-[1fr_220px_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar objetivo por nome ou texto..."
            className="pl-9"
          />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas categorias</SelectItem>
            {folderCategories.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => openEdit(null)}>
          <Plus className="h-4 w-4" /> Novo objetivo
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StartBlankCard onClick={() => openEdit(null)} />
        {sorted.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            onUse={() => openUse(t)}
            onEdit={() => openEdit(t)}
            onDuplicate={() => duplicate(t)}
          />
        ))}
      </div>

      <TemplateEditorDialog
        open={editorOpen}
        onOpenChange={(o) => { setEditorOpen(o); if (!o) setEditing(null); }}
        editing={editing}
        onSavedUse={(t) => openUse(t)}
      />

      <UseTemplateDialog
        open={useOpen}
        onOpenChange={(o) => { setUseOpen(o); if (!o) setUsingTpl(null); }}
        template={usingTpl}
        onGoToSegmented={onGoToSegmented}
      />
    </div>
  );
}