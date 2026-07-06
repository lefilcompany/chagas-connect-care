import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  CareNetworkContact,
  PersonRow,
  PersonWithDerived,
  PersonDerived,
} from "./types";

function ageFromBirth(birth: string | null): number | null {
  if (!birth) return null;
  const d = new Date(birth);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

const RECENT_CONTACT_DAYS = 30;

export function usePeopleWithDerived() {
  return useQuery({
    queryKey: ["people-derived"],
    refetchOnMount: "always",
    queryFn: async (): Promise<PersonWithDerived[]> => {
      const [pRes, cRes, mRes] = await Promise.all([
        supabase
          .from("patients")
          .select("id, full_name, stage, phone, channel_pref, city, state, status, birth_date, owner_id, created_at, updated_at")
          .order("full_name", { ascending: true }),
        supabase
          .from("contacts")
          .select("id, patient_id, full_name, phone, relation, channel_pref, authorization_status, receives_reminders")
          .order("full_name", { ascending: true }),
        supabase
          .from("messages")
          .select("id, patient_id, direction, status, sent_at, failed_at, last_error")
          .order("sent_at", { ascending: false })
          .limit(2000),
      ]);

      if (pRes.error) throw pRes.error;
      if (cRes.error) throw cRes.error;
      if (mRes.error) throw mRes.error;

      const patients = (pRes.data ?? []) as PersonRow[];
      const contacts = (cRes.data ?? []) as CareNetworkContact[];
      const messages = mRes.data ?? [];

      const contactsByPatient = new Map<string, CareNetworkContact[]>();
      for (const c of contacts) {
        if (!c.patient_id) continue;
        const arr = contactsByPatient.get(c.patient_id) ?? [];
        arr.push(c);
        contactsByPatient.set(c.patient_id, arr);
      }

      const lastMsgByPatient = new Map<string, (typeof messages)[number]>();
      const lastInboundByPatient = new Map<string, (typeof messages)[number]>();
      const lastOutboundByPatient = new Map<string, (typeof messages)[number]>();
      for (const m of messages) {
        if (!m.patient_id) continue;
        if (!lastMsgByPatient.has(m.patient_id)) lastMsgByPatient.set(m.patient_id, m);
        if (m.direction === "in" && !lastInboundByPatient.has(m.patient_id)) lastInboundByPatient.set(m.patient_id, m);
        if (m.direction === "out" && !lastOutboundByPatient.has(m.patient_id)) lastOutboundByPatient.set(m.patient_id, m);
      }

      const recentCutoff = Date.now() - RECENT_CONTACT_DAYS * 24 * 3600 * 1000;

      return patients.map<PersonWithDerived>((p) => {
        const cts = contactsByPatient.get(p.id) ?? [];
        const hasCaregiver = cts.some((c) => c.relation === "cuidador" || c.relation === "familiar");
        const hasConsent = cts.length === 0
          ? true
          : cts.some((c) => c.authorization_status === "authorized" || c.authorization_status === "ativo");
        const hasValidChannel = !!(p.phone && p.phone.replace(/\D/g, "").length >= 10);

        const lastMsg = lastMsgByPatient.get(p.id) ?? null;
        const lastOut = lastOutboundByPatient.get(p.id) ?? null;
        const lastIn = lastInboundByPatient.get(p.id) ?? null;
        const lastContactAt = lastMsg?.sent_at ?? null;
        const lastMessageStatus = lastOut?.status ?? null;
        const lastMessageFailed = lastOut?.status === "failed" || !!lastOut?.failed_at;
        const pendingReply = !!lastIn && (!lastOut || new Date(lastIn.sent_at ?? 0) > new Date(lastOut.sent_at ?? 0));
        const staleContact = !lastContactAt || new Date(lastContactAt).getTime() < recentCutoff;

        const pendencies: string[] = [];
        if (!hasValidChannel) pendencies.push("canal");
        if (!hasConsent) pendencies.push("consentimento");
        if (!hasCaregiver) pendencies.push("cuidador");
        if (lastMessageFailed) pendencies.push("falha");
        if (staleContact) pendencies.push("sem-contato");
        if (pendingReply) pendencies.push("aguardando-resposta");

        let nextActionKey: string | null = null;
        if (lastMessageFailed) nextActionKey = "review-failure";
        else if (!hasValidChannel) nextActionKey = "fix-channel";
        else if (!hasCaregiver) nextActionKey = "add-caregiver";
        else if (pendingReply) nextActionKey = "reply";
        else if (staleContact) nextActionKey = "reconnect";

        const derived: PersonDerived = {
          age: ageFromBirth(p.birth_date),
          lastContactAt,
          lastMessageStatus,
          lastMessageFailed,
          pendingReply,
          contactsCount: cts.length,
          hasCaregiver,
          hasConsent,
          hasValidChannel,
          pendencies,
          nextActionKey,
        };
        return { ...p, contacts: cts, derived };
      });
    },
  });
}

export function usePatientContactsForOrbit(patientId: string | undefined) {
  return useQuery({
    queryKey: ["care-orbit", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, full_name, phone, relation, channel_pref, authorization_status, receives_reminders, created_at")
        .eq("patient_id", patientId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCareTimeline(patientId: string | undefined) {
  return useQuery({
    queryKey: ["care-timeline", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const [msgs, meds, adh] = await Promise.all([
        supabase
          .from("messages")
          .select("id, direction, channel, status, body, sent_at, failed_at, template_name")
          .eq("patient_id", patientId!)
          .order("sent_at", { ascending: false })
          .limit(80),
        supabase
          .from("medications")
          .select("id, name, dose, schedule, start_date, end_date, created_at")
          .eq("patient_id", patientId!)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("adherence_events")
          .select("id, event_type, occurred_at, source, medication_id")
          .eq("patient_id", patientId!)
          .order("occurred_at", { ascending: false })
          .limit(60),
      ]);
      type Item = { id: string; at: string; kind: "message" | "medication" | "adherence"; title: string; detail?: string; tone?: "neutral" | "positive" | "warning" | "danger" };
      const items: Item[] = [];
      for (const m of msgs.data ?? []) {
        const at = m.sent_at ?? m.failed_at;
        if (!at) continue;
        items.push({
          id: `m-${m.id}`,
          at,
          kind: "message",
          title:
            m.direction === "in"
              ? "Mensagem recebida"
              : m.template_name
              ? `Modelo enviado: ${m.template_name}`
              : "Mensagem enviada",
          detail: m.body?.slice(0, 160) ?? "",
          tone: m.status === "failed" ? "danger" : m.direction === "in" ? "positive" : "neutral",
        });
      }
      for (const md of meds.data ?? []) {
        items.push({
          id: `md-${md.id}`,
          at: md.created_at,
          kind: "medication",
          title: `Medicação cadastrada: ${md.name}`,
          detail: [md.dose, md.schedule].filter(Boolean).join(" · "),
          tone: "neutral",
        });
      }
      for (const a of adh.data ?? []) {
        items.push({
          id: `a-${a.id}`,
          at: a.occurred_at,
          kind: "adherence",
          title: a.event_type === "confirmado" ? "Adesão confirmada" : "Adesão em falha",
          detail: a.source ? `Fonte: ${a.source}` : undefined,
          tone: a.event_type === "confirmado" ? "positive" : "warning",
        });
      }
      items.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());
      return items;
    },
  });
}
