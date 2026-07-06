import { supabase } from "@/integrations/supabase/client";
import type { Journey, JourneyRun, JourneyRunStep, JourneyStatus, JourneyTask, JourneyTrigger } from "./types";

type JourneyRow = {
  id: string;
  name: string;
  goal: string;
  status: JourneyStatus;
  audience_id: string | null;
  trigger: JourneyTrigger | null;
  graph: { columns?: Journey["columns"] } | null;
  version: number;
  created_at: string;
  updated_at: string;
};

function rowToJourney(row: JourneyRow, audienceLabel?: string): Journey {
  return {
    id: row.id,
    name: row.name,
    goal: row.goal ?? "",
    status: row.status,
    audienceId: row.audience_id,
    audienceLabel,
    trigger: row.trigger ?? { kind: "manual" },
    version: row.version ?? 0,
    columns: row.graph?.columns ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function apiListJourneys(): Promise<Journey[]> {
  const { data, error } = await supabase
    .from("journeys")
    .select("id,name,goal,status,audience_id,trigger,graph,version,created_at,updated_at,audience_segments(name)")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => rowToJourney(r as JourneyRow, r.audience_segments?.name));
}

export async function apiGetJourney(id: string): Promise<Journey | null> {
  const { data, error } = await supabase
    .from("journeys")
    .select("id,name,goal,status,audience_id,trigger,graph,version,created_at,updated_at,audience_segments(name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToJourney(data as any, (data as any).audience_segments?.name);
}

export async function apiCreateJourney(input: { name: string; goal: string; institution: string }) {
  const { data, error } = await supabase
    .from("journeys")
    .insert({
      name: input.name,
      goal: input.goal,
      institution: input.institution,
      graph: {
        columns: [
          { id: crypto.randomUUID(), title: "Entrada", nodes: [{ id: crypto.randomUUID(), kind: "entrada", title: "Definir gatilho" }] },
          { id: crypto.randomUUID(), title: "Ações", nodes: [] },
          { id: crypto.randomUUID(), title: "Encerramento", nodes: [{ id: crypto.randomUUID(), kind: "encerrar", title: "Encerrar" }] },
        ],
      },
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function apiUpdateJourney(id: string, patch: Partial<{
  name: string; goal: string; status: JourneyStatus; audience_id: string | null; trigger: JourneyTrigger;
  graph: { columns: Journey["columns"] };
}>) {
  const { error } = await supabase.from("journeys").update(patch).eq("id", id);
  if (error) throw error;
}

export async function apiDeleteJourney(id: string) {
  const { error } = await supabase.from("journeys").delete().eq("id", id);
  if (error) throw error;
}

export async function apiDuplicateJourney(id: string): Promise<string> {
  const src = await apiGetJourney(id);
  if (!src) throw new Error("Jornada não encontrada");
  const { data: prof } = await supabase.from("profiles").select("institution").eq("id", (await supabase.auth.getUser()).data.user?.id ?? "").maybeSingle();
  const institution = prof?.institution ?? "";
  const clonedCols = src.columns.map((c) => ({
    ...c,
    id: crypto.randomUUID(),
    nodes: c.nodes.map((n) => ({ ...n, id: crypto.randomUUID() })),
  }));
  const { data, error } = await supabase
    .from("journeys")
    .insert({
      name: `${src.name} (cópia)`,
      goal: src.goal,
      institution,
      status: "rascunho",
      trigger: src.trigger,
      audience_id: src.audienceId,
      graph: { columns: clonedCols },
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function apiPublishJourney(id: string) {
  const { data: cur } = await supabase.from("journeys").select("version").eq("id", id).single();
  const { error } = await supabase
    .from("journeys")
    .update({ status: "ativa", version: (cur?.version ?? 0) + 1 })
    .eq("id", id);
  if (error) throw error;
}

export async function apiPauseJourney(id: string) {
  const { error } = await supabase.from("journeys").update({ status: "pausada" }).eq("id", id);
  if (error) throw error;
}

export async function apiArchiveJourney(id: string) {
  const { error } = await supabase.from("journeys").update({ status: "arquivada" }).eq("id", id);
  if (error) throw error;
}

export async function apiJourneyRunCounts(journeyId: string): Promise<Journey["metrics"]> {
  const { data, error } = await supabase
    .from("journey_runs")
    .select("status, ended_at")
    .eq("journey_id", journeyId);
  if (error) throw error;
  const m = { active: 0, waiting: 0, completed: 0, failed: 0, stopped: 0, handoff: 0, lastRunAt: undefined as string | undefined };
  for (const r of data ?? []) {
    if (r.status === "queued" || r.status === "running") m.active++;
    else if (r.status === "waiting") m.waiting++;
    else if (r.status === "completed") m.completed++;
    else if (r.status === "failed") m.failed++;
    else if (r.status === "stopped") m.stopped++;
    else if (r.status === "handoff") m.handoff++;
    if (r.ended_at && (!m.lastRunAt || r.ended_at > m.lastRunAt)) m.lastRunAt = r.ended_at;
  }
  return m;
}

export async function apiEnroll(journeyId: string, patientIds: string[]) {
  const { data, error } = await supabase.functions.invoke("journey-enroll", {
    body: { journey_id: journeyId, patient_ids: patientIds },
  });
  if (error) throw error;
  return data as { ok: boolean; inserted: number; skipped_no_phone: number; skipped_dedupe: number; invalid_patient_count: number };
}

export async function apiRunRunnerNow() {
  const { data, error } = await supabase.functions.invoke("journey-runner", { body: {} });
  if (error) throw error;
  return data as { ok: boolean; processed: number };
}

export async function apiListRuns(journeyId: string, limit = 100): Promise<JourneyRun[]> {
  const { data, error } = await supabase
    .from("journey_runs")
    .select("id, journey_id, patient_id, status, current_node_id, entered_at, ended_at, resume_at, error, patients(full_name)")
    .eq("journey_id", journeyId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    journeyId: r.journey_id,
    patientId: r.patient_id,
    patientName: r.patients?.full_name,
    status: r.status,
    currentNodeId: r.current_node_id,
    enteredAt: r.entered_at,
    endedAt: r.ended_at,
    resumeAt: r.resume_at,
    error: r.error,
  }));
}

export async function apiListRunSteps(runId: string): Promise<JourneyRunStep[]> {
  const { data, error } = await supabase
    .from("journey_run_steps")
    .select("id, run_id, node_id, node_kind, status, attempt, started_at, finished_at, detail, error")
    .eq("run_id", runId)
    .order("started_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id, runId: r.run_id, nodeId: r.node_id, nodeKind: r.node_kind,
    status: r.status, attempt: r.attempt, startedAt: r.started_at,
    finishedAt: r.finished_at, detail: r.detail ?? {}, error: r.error,
  }));
}

export async function apiListTasks(): Promise<JourneyTask[]> {
  const { data, error } = await supabase
    .from("journey_tasks")
    .select("id, title, description, status, priority, patient_id, journey_id, run_id, due_at, created_at, patients(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id, title: r.title, description: r.description,
    status: r.status, priority: r.priority,
    patientId: r.patient_id, patientName: r.patients?.full_name,
    journeyId: r.journey_id, runId: r.run_id, dueAt: r.due_at,
    createdAt: r.created_at,
  }));
}

export async function apiUpdateTask(id: string, patch: Partial<{ status: JourneyTask["status"]; assignee_id: string | null }>) {
  const { error } = await supabase.from("journey_tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function apiListAudiences() {
  const { data, error } = await supabase.from("audience_segments").select("id, name").order("name");
  if (error) throw error;
  return (data ?? []) as { id: string; name: string }[];
}

export async function apiCurrentInstitution(): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return "";
  const { data } = await supabase.from("profiles").select("institution").eq("id", u.user.id).maybeSingle();
  return data?.institution ?? "";
}