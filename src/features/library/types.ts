import type { TargetingMode } from "@/lib/segments";

export type LibraryStatus =
  | "rascunho"
  | "revisao-clinica"
  | "revisao-privacidade"
  | "aprovado"
  | "expirando"
  | "arquivado";

export type LibraryItem = {
  id: string;
  title: string;
  body: string;
  category: string;
  audience: string;
  targeting_mode: TargetingMode | null;
  created_at: string;
  status: LibraryStatus;
  /** Character length as proxy for reading effort */
  readingSeconds: number;
};

export const STATUS_LABEL: Record<LibraryStatus, string> = {
  rascunho: "Rascunho",
  "revisao-clinica": "Revisão clínica",
  "revisao-privacidade": "Revisão privacidade",
  aprovado: "Aprovado",
  expirando: "Expirando",
  arquivado: "Arquivado",
};

export const STATUS_TONE: Record<LibraryStatus, string> = {
  rascunho: "bg-secondary text-ink border-border",
  "revisao-clinica": "bg-coral-soft text-primary border-coral/40",
  "revisao-privacidade": "bg-coral-soft text-primary border-coral/40",
  aprovado: "bg-mint-soft text-care border-care/30",
  expirando: "bg-coral-soft text-primary border-coral/40",
  arquivado: "bg-muted text-muted-foreground border-border",
};