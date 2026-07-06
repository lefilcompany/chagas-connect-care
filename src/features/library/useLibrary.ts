import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LibraryItem, LibraryStatus } from "./types";
import type { TargetingMode } from "@/lib/segments";

/** Words-per-minute proxy — 180 wpm reading speed. */
function estimateReadingSeconds(body: string): number {
  const words = (body ?? "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(5, Math.round((words / 180) * 60));
}

/**
 * Deriva um status de ciclo clínico a partir dos campos existentes.
 * Isso é temporário até que o schema clínico (Fase 6) adicione uma coluna dedicada.
 */
function deriveStatus(row: { body: string; created_at: string }): LibraryStatus {
  const b = (row.body ?? "").trim();
  if (!b) return "rascunho";
  if (b.length < 40) return "revisao-clinica";
  const ageDays = (Date.now() - new Date(row.created_at).getTime()) / 86_400_000;
  if (ageDays > 365) return "expirando";
  return "aprovado";
}

type Row = {
  id: string;
  title: string;
  body: string;
  category: string;
  audience: string;
  targeting_mode: string | null;
  created_at: string;
};

export function useLibrary() {
  return useQuery<LibraryItem[]>({
    queryKey: ["library-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_library")
        .select("id, title, body, category, audience, targeting_mode, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Row[]).map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        category: r.category,
        audience: r.audience,
        targeting_mode: (r.targeting_mode as TargetingMode | null) ?? null,
        created_at: r.created_at,
        status: deriveStatus(r),
        readingSeconds: estimateReadingSeconds(r.body),
      }));
    },
  });
}