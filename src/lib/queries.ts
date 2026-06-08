import { supabase } from "@/integrations/supabase/client";
import { normalizeFilters } from "@/lib/segments";
import type { QueryClient } from "@tanstack/react-query";

export const qk = {
  dashboard: ["dashboard-stats"] as const,
  patients: ["patients"] as const,
  patient: (id: string) => ["patient", id] as const,
  patientContacts: (id: string) => ["patient", id, "contacts"] as const,
  patientMeds: (id: string) => ["patient", id, "meds"] as const,
  patientMessages: (id: string) => ["patient", id, "messages"] as const,
  patientAdherence: (id: string) => ["patient", id, "adherence"] as const,
  messages: ["messages"] as const,
  content: ["content"] as const,
  reports: ["reports"] as const,
  integrationsLog: ["crm-log"] as const,
  profile: (id: string) => ["profile", id] as const,
  segments: ["segments"] as const,
  templates: ["message-templates"] as const,
  batches: ["message-batches"] as const,
};

export const fetchers = {
  dashboard: async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const thirty = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const [p, m, mt, ad, mTotal] = await Promise.all([
      supabase.from("patients").select("id", { count: "exact", head: true }),
      supabase.from("medications").select("id", { count: "exact", head: true }),
      supabase.from("messages").select("id", { count: "exact", head: true }).gte("sent_at", today.toISOString()),
      supabase.from("adherence_events").select("event_type").gte("occurred_at", thirty),
      supabase.from("messages").select("id", { count: "exact", head: true }),
    ]);
    const events = ad.data ?? [];
    const ok = events.filter((e) => e.event_type === "confirmado").length;
    const adh = events.length ? Math.round((ok / events.length) * 100) : 0;
    return {
      patients: p.count ?? 0,
      messagesToday: mt.count ?? 0,
      adherence30: adh,
      meds: m.count ?? 0,
      messagesTotal: mTotal.count ?? 0,
      adherenceEvents: events.length,
    };
  },
  patients: async () => {
    const { data } = await supabase.from("patients").select("*").order("created_at", { ascending: false });
    return data ?? [];
  },
  messages: async () => {
    const [msgs, contacts] = await Promise.all([
      supabase.from("messages").select("*, patients(full_name, phone)").order("sent_at", { ascending: false }).limit(200),
      supabase.from("contacts").select("id, full_name, phone, relation"),
    ]);
    const cmap = new Map((contacts.data ?? []).map((c: any) => [c.id, c]));
    return (msgs.data ?? []).map((m: any) => ({ ...m, contact: m.contact_id ? cmap.get(m.contact_id) ?? null : null }));
  },
  content: async () => {
    const { data } = await supabase.from("content_library").select("*").order("created_at", { ascending: false });
    return data ?? [];
  },
  reports: async () => {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data: events } = await supabase.from("adherence_events").select("patient_id, event_type, patients(full_name)").gte("occurred_at", since);
    const map = new Map<string, { name: string; ok: number; total: number }>();
    (events ?? []).forEach((e: any) => {
      const cur = map.get(e.patient_id) ?? { name: e.patients?.full_name ?? "—", ok: 0, total: 0 };
      cur.total++; if (e.event_type === "confirmado") cur.ok++;
      map.set(e.patient_id, cur);
    });
    const byPatient = Array.from(map.values())
      .map((v) => ({ name: v.name, rate: Math.round((v.ok / v.total) * 100) }))
      .sort((a, b) => a.rate - b.rate);
    const ok = (events ?? []).filter((e: any) => e.event_type === "confirmado").length;
    const miss = (events ?? []).length - ok;
    const { count } = await supabase.from("messages").select("id", { count: "exact", head: true }).gte("sent_at", since);
    return { byPatient, totals: { ok, miss, msgs: count ?? 0 } };
  },
  integrationsLog: async () => {
    const { data } = await supabase.from("crm_sync_log").select("*").order("created_at", { ascending: false }).limit(20);
    return data ?? [];
  },
  profile: async (userId: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    return data;
  },
  segments: async () => {
    const { data } = await supabase
      .from("audience_segments")
      .select("*")
      .order("created_at", { ascending: false });
    return (data ?? []) as any[];
  },
  templates: async () => {
    const { data } = await supabase
      .from("message_templates")
      .select("*")
      .order("created_at", { ascending: false });
    return (data ?? []) as any[];
  },
  batches: async () => {
    const { data } = await supabase
      .from("message_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    return (data ?? []) as any[];
  },
};

const routeMap: Record<string, (qc: QueryClient) => void> = {
  "/app": (qc) => qc.prefetchQuery({ queryKey: qk.dashboard, queryFn: fetchers.dashboard }),
  "/app/pacientes": (qc) => qc.prefetchQuery({ queryKey: qk.patients, queryFn: fetchers.patients }),
  "/app/mensagens": (qc) => qc.prefetchQuery({ queryKey: qk.messages, queryFn: fetchers.messages }),
  "/app/conteudos": (qc) => qc.prefetchQuery({ queryKey: qk.content, queryFn: fetchers.content }),
  "/app/relatorios": (qc) => qc.prefetchQuery({ queryKey: qk.reports, queryFn: fetchers.reports }),
  "/app/integracoes": (qc) => qc.prefetchQuery({ queryKey: qk.integrationsLog, queryFn: fetchers.integrationsLog }),
  "/app/segmentos": (qc) => qc.prefetchQuery({ queryKey: qk.segments, queryFn: fetchers.segments }),
};

export const prefetchRoute = (qc: QueryClient, path: string) => {
  routeMap[path]?.(qc);
};

export const prefetchAllAppRoutes = (qc: QueryClient) => {
  Object.values(routeMap).forEach((fn) => fn(qc));
};