import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Pill, Utensils, Moon, Activity, Users, Stethoscope,
  HeartHandshake, BookOpen, Layers, FolderOpen, MessageSquare,
  Megaphone, Bell, Calendar, ClipboardList, Heart, Star,
  Sparkles, FileText, Phone, Mail, AlertCircle, Shield,
  type LucideIcon,
} from "lucide-react";
import { TEMPLATE_CATEGORIES } from "@/lib/templates";

/** Selectable icon set for custom folders. */
export const FOLDER_ICONS: { name: string; Icon: LucideIcon }[] = [
  { name: "FolderOpen", Icon: FolderOpen },
  { name: "Pill", Icon: Pill },
  { name: "Utensils", Icon: Utensils },
  { name: "Stethoscope", Icon: Stethoscope },
  { name: "HeartHandshake", Icon: HeartHandshake },
  { name: "BookOpen", Icon: BookOpen },
  { name: "Moon", Icon: Moon },
  { name: "Activity", Icon: Activity },
  { name: "Users", Icon: Users },
  { name: "Layers", Icon: Layers },
  { name: "MessageSquare", Icon: MessageSquare },
  { name: "Megaphone", Icon: Megaphone },
  { name: "Bell", Icon: Bell },
  { name: "Calendar", Icon: Calendar },
  { name: "ClipboardList", Icon: ClipboardList },
  { name: "Heart", Icon: Heart },
  { name: "Star", Icon: Star },
  { name: "Sparkles", Icon: Sparkles },
  { name: "FileText", Icon: FileText },
  { name: "Phone", Icon: Phone },
  { name: "Mail", Icon: Mail },
  { name: "AlertCircle", Icon: AlertCircle },
  { name: "Shield", Icon: Shield },
];

export const iconByName = (name: string | null | undefined): LucideIcon =>
  FOLDER_ICONS.find((i) => i.name === name)?.Icon ?? FolderOpen;

/** Built-in (system) folders. Cannot be deleted. */
export const BASE_FOLDERS: {
  value: string; label: string; icon: LucideIcon; description: string; isCustom?: false;
}[] = [
  { value: "medicacao",   label: "Medicação",         icon: Pill,           description: "Lembretes de dose, horários e adesão à medicação." },
  { value: "alimentacao", label: "Alimentação",       icon: Utensils,       description: "Orientações nutricionais e hábitos alimentares." },
  { value: "consulta",    label: "Consulta",          icon: Stethoscope,    description: "Confirmações, lembretes e preparo de consultas." },
  { value: "adesao",      label: "Adesão",            icon: HeartHandshake, description: "Reforço de tratamento e acompanhamento." },
  { value: "orientacao",  label: "Orientação",        icon: BookOpen,       description: "Materiais educativos e instruções gerais." },
  { value: "sono",        label: "Sono",              icon: Moon,           description: "Higiene do sono e rotina de descanso." },
  { value: "atividade",   label: "Atividade física",  icon: Activity,       description: "Recomendações de movimento e exercícios." },
  { value: "familia",     label: "Família",           icon: Users,          description: "Conteúdos para familiares e cuidadores." },
  { value: "geral",       label: "Geral",             icon: Layers,         description: "Mensagens variadas que não se encaixam em outras pastas." },
];

export const FALLBACK_FOLDER = "geral";

export type FolderDef = {
  value: string;
  label: string;
  icon: LucideIcon;
  description: string;
  isCustom: boolean;
  id?: string;
};

type CustomFolderRow = {
  id: string; slug: string; label: string; description: string; icon: string;
};

/** Fetches custom folders and exposes merged helpers. */
export function useFolders() {
  const { data: customRows = [] } = useQuery<CustomFolderRow[]>({
    queryKey: ["content-folders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_folders")
        .select("id, slug, label, description, icon")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CustomFolderRow[];
    },
  });

  const folders = useMemo<FolderDef[]>(() => {
    const base = BASE_FOLDERS.map((f) => ({ ...f, isCustom: false as const }));
    const customs = customRows.map<FolderDef>((r) => ({
      value: r.slug,
      label: r.label,
      description: r.description ?? "",
      icon: iconByName(r.icon),
      isCustom: true,
      id: r.id,
    }));
    return [...base, ...customs];
  }, [customRows]);

  const folderOf = (cat: string | null | undefined): string =>
    folders.find((f) => f.value === cat)?.value ?? FALLBACK_FOLDER;
  const folderLabel = (cat: string | null | undefined): string =>
    folders.find((f) => f.value === cat)?.label ?? "Geral";

  // Merged categories for Select inputs (folders + template-only labels not in folders).
  const categories = useMemo(() => {
    const seen = new Set(folders.map((f) => f.value));
    const extras = TEMPLATE_CATEGORIES.filter((c) => !seen.has(c.value));
    return [...folders.map((f) => ({ value: f.value, label: f.label })), ...extras];
  }, [folders]);

  return { folders, customFolders: customRows, folderOf, folderLabel, categories };
}