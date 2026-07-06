// Journey runner — processa runs pendentes (queued/running) e runs em espera cujo resume_at já chegou.
// Invocado por: cron (a cada 1 min) ou manualmente via edge function.
// Autoriza via header x-runner-secret (JOURNEY_RUNNER_SECRET) OU JWT do próprio caller.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RUNNER_SECRET = Deno.env.get("JOURNEY_RUNNER_SECRET") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const BATCH = 25;
const MAX_ATTEMPTS = 3;
const BACKOFF_MIN = [1, 5, 30]; // minutes

type Node = { id: string; kind: string; title?: string; description?: string; config?: Record<string, any> };
type Column = { id: string; title: string; nodes: Node[] };
type Graph = { columns: Column[] };

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function flattenNodes(graph: Graph): Node[] {
  return (graph?.columns ?? []).flatMap((c) => c.nodes ?? []);
}

function nextNodeId(graph: Graph, currentId: string | null): string | null {
  const all = flattenNodes(graph);
  if (!all.length) return null;
  if (!currentId) return all[0].id;
  const idx = all.findIndex((n) => n.id === currentId);
  if (idx < 0 || idx >= all.length - 1) return null;
  return all[idx + 1].id;
}

function findNode(graph: Graph, id: string): Node | null {
  return flattenNodes(graph).find((n) => n.id === id) ?? null;
}

async function logStep(runId: string, node: Node, status: string, attempt: number, detail: any, error?: string | null) {
  await admin.from("journey_run_steps").insert({
    run_id: runId,
    node_id: node.id,
    node_kind: node.kind,
    status,
    attempt,
    finished_at: new Date().toISOString(),
    detail,
    error: error ?? null,
  });
}

async function executeNode(run: any, node: Node, journey: any): Promise<{
  outcome: "advance" | "wait" | "complete" | "fail" | "handoff";
  resume_at?: string;
  context?: Record<string, any>;
  detail?: any;
  error?: string;
}> {
  const cfg = node.config ?? {};
  switch (node.kind) {
    case "entrada":
    case "audiencia":
    case "condicao":
    case "verificar-resposta":
      // v1: entrada/audiência já foram validadas no enroll; condição avalia trivialmente true e segue.
      // Ramificações complexas ficam para a v2.
      return { outcome: "advance", detail: { note: "avaliado como verdadeiro (v1)" } };

    case "aguardar": {
      const minutes = Number(cfg.minutes ?? cfg.wait_minutes ?? 60);
      const resume = new Date(Date.now() + Math.max(1, minutes) * 60_000).toISOString();
      return { outcome: "wait", resume_at: resume, detail: { wait_minutes: minutes } };
    }

    case "whatsapp": {
      if (!run.patient_id) return { outcome: "fail", error: "run sem patient_id" };
      const templateId = cfg.template_id ?? null;
      const body = String(cfg.body ?? node.description ?? "").trim();
      // Busca telefone do paciente
      const { data: patient } = await admin
        .from("patients")
        .select("phone, institution")
        .eq("id", run.patient_id)
        .maybeSingle();
      if (!patient?.phone) return { outcome: "fail", error: "paciente sem telefone" };

      // Insere mensagem em queued
      const { data: msg, error: insErr } = await admin
        .from("messages")
        .insert({
          patient_id: run.patient_id,
          channel: "whatsapp",
          direction: "outbound",
          body: body || "(template)",
          status: "queued",
          message_type: "journey",
          template_id: templateId,
          template_variables: cfg.variables ?? {},
        })
        .select("id")
        .maybeSingle();
      if (insErr || !msg) return { outcome: "fail", error: insErr?.message ?? "falha ao criar mensagem" };

      // Dispara send-whatsapp
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE}`,
          apikey: SERVICE_ROLE,
        },
        body: JSON.stringify({ message_id: msg.id }),
      });
      const respBody = await resp.json().catch(() => ({}));
      if (!resp.ok || respBody?.ok === false) {
        return { outcome: "fail", error: `send-whatsapp: ${resp.status} ${respBody?.error ?? ""}`, detail: { message_id: msg.id } };
      }
      return { outcome: "advance", detail: { message_id: msg.id }, context: { last_message_id: msg.id } };
    }

    case "sms":
    case "email":
    case "pagina-segura":
      return { outcome: "advance", detail: { skipped: true, reason: `canal ${node.kind} não habilitado` } };

    case "criar-tarefa": {
      await admin.from("journey_tasks").insert({
        institution: run.institution,
        run_id: run.id,
        journey_id: run.journey_id,
        patient_id: run.patient_id,
        title: String(cfg.title ?? node.title ?? "Tarefa da jornada"),
        description: String(cfg.description ?? node.description ?? ""),
        priority: (cfg.priority as string) ?? "media",
      });
      return { outcome: "advance", detail: { created: true } };
    }

    case "notificar-equipe":
      return { outcome: "advance", detail: { notified: true, message: cfg.message ?? node.description ?? "" } };

    case "encaminhar-humano":
      return { outcome: "handoff", detail: { reason: cfg.reason ?? "encaminhado para atendimento humano" } };

    case "encerrar":
      return { outcome: "complete", detail: { reason: "nó encerrar" } };

    default:
      return { outcome: "advance", detail: { note: `kind ${node.kind} sem handler` } };
  }
}

async function processRun(run: any): Promise<{ id: string; result: string }> {
  // Busca a jornada + graph
  const { data: journey } = await admin
    .from("journeys")
    .select("id, status, graph")
    .eq("id", run.journey_id)
    .maybeSingle();

  if (!journey) {
    await admin.from("journey_runs").update({ status: "failed", error: "jornada não encontrada", ended_at: new Date().toISOString() }).eq("id", run.id);
    return { id: run.id, result: "journey_missing" };
  }
  if (journey.status === "pausada" || journey.status === "arquivada") {
    await admin.from("journey_runs").update({ status: "stopped", ended_at: new Date().toISOString() }).eq("id", run.id);
    return { id: run.id, result: "stopped_by_journey_status" };
  }

  const graph = (journey.graph ?? { columns: [] }) as Graph;
  const nodeId = run.current_node_id ?? nextNodeId(graph, null);
  if (!nodeId) {
    await admin.from("journey_runs").update({ status: "completed", ended_at: new Date().toISOString() }).eq("id", run.id);
    return { id: run.id, result: "completed_empty" };
  }
  const node = findNode(graph, nodeId);
  if (!node) {
    await admin.from("journey_runs").update({ status: "completed", ended_at: new Date().toISOString() }).eq("id", run.id);
    return { id: run.id, result: "completed_no_node" };
  }

  const attempt = (run.attempt ?? 0) + 1;
  const result = await executeNode(run, node, journey);

  if (result.outcome === "advance") {
    await logStep(run.id, node, "ok", attempt, result.detail ?? {});
    const next = nextNodeId(graph, node.id);
    if (!next) {
      await admin.from("journey_runs").update({ status: "completed", ended_at: new Date().toISOString(), current_node_id: node.id, attempt: 0 }).eq("id", run.id);
      return { id: run.id, result: "completed" };
    }
    await admin.from("journey_runs").update({
      status: "running",
      current_node_id: next,
      attempt: 0,
      context: { ...(run.context ?? {}), ...(result.context ?? {}) },
    }).eq("id", run.id);
    return { id: run.id, result: "advanced" };
  }

  if (result.outcome === "wait") {
    await logStep(run.id, node, "waiting", attempt, result.detail ?? {});
    await admin.from("journey_runs").update({
      status: "waiting",
      current_node_id: node.id,
      resume_at: result.resume_at,
      attempt: 0,
    }).eq("id", run.id);
    return { id: run.id, result: "waiting" };
  }

  if (result.outcome === "complete") {
    await logStep(run.id, node, "ok", attempt, result.detail ?? {});
    await admin.from("journey_runs").update({ status: "completed", ended_at: new Date().toISOString(), current_node_id: node.id, attempt: 0 }).eq("id", run.id);
    return { id: run.id, result: "completed" };
  }

  if (result.outcome === "handoff") {
    await logStep(run.id, node, "ok", attempt, result.detail ?? {});
    await admin.from("journey_runs").update({ status: "handoff", ended_at: new Date().toISOString(), current_node_id: node.id, attempt: 0 }).eq("id", run.id);
    return { id: run.id, result: "handoff" };
  }

  // fail
  if (attempt < MAX_ATTEMPTS) {
    const wait = BACKOFF_MIN[Math.min(attempt - 1, BACKOFF_MIN.length - 1)];
    await logStep(run.id, node, "failed", attempt, result.detail ?? {}, result.error);
    await admin.from("journey_runs").update({
      status: "waiting",
      current_node_id: node.id,
      resume_at: new Date(Date.now() + wait * 60_000).toISOString(),
      attempt,
      error: result.error ?? null,
    }).eq("id", run.id);
    return { id: run.id, result: `retry_${attempt}` };
  }
  await logStep(run.id, node, "failed", attempt, result.detail ?? {}, result.error);
  await admin.from("journey_runs").update({ status: "failed", ended_at: new Date().toISOString(), current_node_id: node.id, attempt, error: result.error ?? null }).eq("id", run.id);
  return { id: run.id, result: "failed" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth: cron (x-runner-secret) OU usuário autenticado (invocação manual)
  const runnerHeader = req.headers.get("x-runner-secret");
  const isCron = RUNNER_SECRET.length > 0 && runnerHeader === RUNNER_SECRET;
  if (!isCron) {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return j(401, { error: "Unauthorized" });
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data, error } = await anonClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (error || !data?.claims) return j(401, { error: "Unauthorized" });
  }

  // Seleciona lote de runs elegíveis
  const nowIso = new Date().toISOString();
  const { data: runs, error: selErr } = await admin
    .from("journey_runs")
    .select("id, journey_id, institution, patient_id, status, current_node_id, resume_at, context, attempt")
    .or(`status.in.(queued,running),and(status.eq.waiting,resume_at.lte.${nowIso})`)
    .order("updated_at", { ascending: true })
    .limit(BATCH);

  if (selErr) return j(500, { error: selErr.message });
  if (!runs?.length) return j(200, { ok: true, processed: 0 });

  const results: any[] = [];
  for (const run of runs) {
    try {
      // trava lógica: marca running antes de processar
      const { error: lockErr } = await admin
        .from("journey_runs")
        .update({ status: "running", updated_at: new Date().toISOString() })
        .eq("id", run.id)
        .in("status", ["queued", "running", "waiting"]);
      if (lockErr) { results.push({ id: run.id, result: "lock_failed" }); continue; }
      const r = await processRun(run);
      results.push(r);
    } catch (e) {
      results.push({ id: run.id, result: "error", error: (e as Error).message });
    }
  }

  return j(200, { ok: true, processed: results.length, results });
});