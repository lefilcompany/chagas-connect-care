export type JourneyStatus = "rascunho" | "pausada" | "ativa-preview" | "arquivada";

export type JourneyNodeKind =
  | "entrada"
  | "evento"
  | "audiencia"
  | "condicao"
  | "whatsapp"
  | "sms"
  | "email"
  | "pagina-segura"
  | "aguardar"
  | "verificar-resposta"
  | "criar-tarefa"
  | "notificar-equipe"
  | "encaminhar-humano"
  | "encerrar";

export type JourneyNode = {
  id: string;
  kind: JourneyNodeKind;
  title: string;
  description?: string;
  /** free-form config so o preview aceita qualquer campo sem migração */
  config?: Record<string, string>;
};

export type JourneyColumn = {
  id: string;
  title: string;
  nodes: JourneyNode[];
};

export type Journey = {
  id: string;
  name: string;
  goal: string;
  status: JourneyStatus;
  audienceLabel?: string;
  columns: JourneyColumn[];
  createdAt: string;
  updatedAt: string;
  /** métricas simuladas para o card — nunca executadas */
  metrics?: {
    active: number;
    completed: number;
    interrupted: number;
    failed: number;
    responseRate: number;
    lastRunAt?: string;
  };
};