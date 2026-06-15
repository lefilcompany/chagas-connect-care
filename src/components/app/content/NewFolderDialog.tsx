import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { FOLDER_ICONS } from "@/hooks/useFolders";
import { cn } from "@/lib/utils";

/** Normalizes a label into a URL-safe slug used as folder identifier. */
function toSlug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

export function NewFolderDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: (slug: string) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("FolderOpen");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setLabel(""); setDescription(""); setIcon("FolderOpen"); }
  }, [open]);

  const slug = useMemo(() => toSlug(label), [label]);
  const canSave = label.trim().length >= 2 && slug.length >= 2 && !saving;

  const save = async () => {
    if (!user) return toast.error("Sessão expirada");
    if (!canSave) return;
    setSaving(true);
    const { data: profile } = await supabase
      .from("profiles").select("institution").eq("id", user.id).maybeSingle();
    const institution = profile?.institution ?? "";
    if (!institution) {
      setSaving(false);
      return toast.error("Sua conta não está vinculada a uma instituição.");
    }
    const { error } = await supabase.from("content_folders").insert({
      institution,
      slug,
      label: label.trim(),
      description: description.trim(),
      icon,
      created_by: user.id,
    });
    setSaving(false);
    if (error) {
      if (error.code === "23505") return toast.error("Já existe uma pasta com esse nome.");
      return toast.error(error.message);
    }
    toast.success("Pasta criada");
    qc.invalidateQueries({ queryKey: ["content-folders"] });
    onCreated?.(slug);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova pasta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="folder-label">Nome da pasta</Label>
            <Input
              id="folder-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: Pré-operatório"
              maxLength={60}
            />
            {label && (
              <p className="text-xs text-muted-foreground">
                Identificador: <span className="font-mono">{slug || "—"}</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="folder-desc">Descrição (opcional)</Label>
            <Textarea
              id="folder-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Para que serve essa pasta?"
              rows={2}
              maxLength={240}
            />
          </div>

          <div className="space-y-2">
            <Label>Ícone</Label>
            <div className="grid grid-cols-8 gap-2">
              {FOLDER_ICONS.map(({ name, Icon }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setIcon(name)}
                  className={cn(
                    "h-10 w-10 rounded-lg border flex items-center justify-center transition-colors",
                    icon === name
                      ? "border-primary bg-primary/10 text-brand"
                      : "border-border hover:bg-muted text-muted-foreground",
                  )}
                  aria-label={name}
                >
                  <Icon className="h-5 w-5" />
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="hero" onClick={save} disabled={!canSave}>
            {saving ? "Salvando..." : "Criar pasta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}