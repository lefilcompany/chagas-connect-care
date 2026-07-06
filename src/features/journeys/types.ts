export type JourneyStatus = "rascunho" | "ativa" | "pausada" | "arquivada";

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

export type JourneyTrigger = {
  kind: "manual" | "event";
  event?: "patient.created" | "patient.appointment_upcoming";
};

export type Journey = {
  id: string;
  name: string;
  goal: string;
  status: JourneyStatus;
  audienceId?: string | null;
  audienceLabel?: string;
  trigger: JourneyTrigger;
  version: number;
  columns: JourneyColumn[];
  createdAt: string;
  updatedAt: string;
  metrics?: {
    active: number;
    waiting: number;
    completed: number;
    failed: number;
    stopped: number;
    handoff: number;
    lastRunAt?: string;
  };
};

export type JourneyRunStatus =
  | "queued" | "running" | "waiting" | "completed" | "failed" | "stopped" | "handoff";

export type JourneyRun = {
  id: string;
  journeyId: string;
  patientId: string | null;
  patientName?: string;
  status: JourneyRunStatus;
  currentNodeId: string | null;
  enteredAt: string;
  endedAt: string | null;
  resumeAt: string | null;
  error: string | null;
};

export type JourneyRunStep = {
  id: string;
  runId: string;
  nodeId: string;
  nodeKind: string;
  status: "ok" | "skipped" | "failed" | "waiting";
  attempt: number;
  startedAt: string;
  finishedAt: string | null;
  detail: Record<string, unknown>;
  error: string | null;
};

export type JourneyTask = {
  id: string;
  title: string;
  description: string;
  status: "aberta" | "concluida" | "cancelada";
  priority: "baixa" | "media" | "alta";
  patientId: string | null;
  patientName?: string;
  journeyId: string | null;
  runId: string | null;
  dueAt: string | null;
  createdAt: string;
};