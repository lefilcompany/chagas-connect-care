import { supabase } from "@/integrations/supabase/client";

export type AudienceType = "paciente" | "familiar" | "cuidador" | "medico";

export type SegmentFilters = {
  stages?: string[];
  city?: string[];
  state?: string[];
  age_min?: number | null;
  age_max?: number | null;
  status?: "ativo" | "inativo" | "";
  channel?: "whatsapp" | "sms" | "";
};

export type SegmentDef = {
  id: string;
  name: string;
  description: string;
  audience_types: AudienceType[];
  filters: SegmentFilters;
  owner_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Recipient = {
  key: string;
  kind: "patient" | "contact";
  patient_id: string;
  contact_id?: string;
  name: string;
  phone: string;
  channel: "whatsapp" | "sms";
  relation: AudienceType;
  patient_name: string;
  city?: string;
  state?: string;
};

export const AUDIENCE_LABELS: Record<AudienceType, string> = {
  paciente: "Pacientes",
  familiar: "Familiares",
  cuidador: "Cuidadores",
  medico: "Médicos",
};

const ageFromBirth = (birth: string | null | undefined): number | null => {
  if (!birth) return null;
  const d = new Date(birth);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
};

const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();

const toStrArr = (v: unknown): string[] => {
  if (Array.isArray(v)) return v as string[];
  if (typeof v === "string" && v) return [v];
  return [];
};

const matchesCommon = (
  row: { city?: string | null; state?: string | null; status?: string | null; channel_pref?: string | null; birth_date?: string | null },
  f: SegmentFilters,
): boolean => {
  const cities = toStrArr(f.city);
  const states = toStrArr(f.state);
  if (cities.length && !cities.some((c) => norm(row.city).includes(norm(c)))) return false;
  if (states.length && !states.some((s) => norm(row.state) === norm(s))) return false;
  if (f.status && (row.status ?? "ativo") !== f.status) return false;
  if (f.channel && (row.channel_pref ?? "") !== f.channel) return false;
  const age = ageFromBirth(row.birth_date);
  if (f.age_min != null && (age == null || age < f.age_min)) return false;
  if (f.age_max != null && (age == null || age > f.age_max)) return false;
  return true;
};

export const resolveRecipients = async (
  audience_types: AudienceType[],
  filters: SegmentFilters,
): Promise<Recipient[]> => {
  if (!audience_types.length) return [];

  const { data: patientsData } = await supabase
    .from("patients")
    .select("id, full_name, phone, channel_pref, stage, city, state, status, birth_date");
  const patients = patientsData ?? [];

  const matchPatient = (p: any) => {
    if (f_active.stages?.length && !f_active.stages.includes(p.stage)) return false;
    return matchesCommon(p, f_active);
  };

  const f_active = filters ?? {};
  const out: Recipient[] = [];

  const patientPool = patients.filter(matchPatient);
  const patientMap = new Map(patients.map((p: any) => [p.id, p]));

  if (audience_types.includes("paciente")) {
    for (const p of patientPool) {
      out.push({
        key: `p:${p.id}`,
        kind: "patient",
        patient_id: p.id,
        name: p.full_name,
        phone: p.phone ?? "",
        channel: ((p.channel_pref as "whatsapp" | "sms") ?? "whatsapp"),
        relation: "paciente",
        patient_name: p.full_name,
        city: p.city ?? "",
        state: p.state ?? "",
      });
    }
  }

  const contactRels = audience_types.filter((r) => r !== "paciente");
  if (contactRels.length) {
    const { data: contactsData } = await supabase
      .from("contacts")
      .select("id, patient_id, full_name, phone, channel_pref, relation, city, state, status, birth_date");
    const contacts = contactsData ?? [];
    for (const c of contacts) {
      if (!(contactRels as AudienceType[]).includes(c.relation as AudienceType)) continue;
      const parent = patientMap.get(c.patient_id) as any;
      if (!parent) continue;
      // patient-level filters (stage) still apply via parent
      if (f_active.stages?.length && !f_active.stages.includes(parent.stage)) continue;
      // contact-level filters
      if (!matchesCommon(c as any, f_active)) continue;
      out.push({
        key: `c:${c.id}`,
        kind: "contact",
        patient_id: c.patient_id,
        contact_id: c.id,
        name: c.full_name,
        phone: c.phone ?? "",
        channel: ((c.channel_pref as "whatsapp" | "sms") ?? "whatsapp"),
        relation: c.relation as AudienceType,
        patient_name: parent.full_name,
        city: c.city ?? "",
        state: c.state ?? "",
      });
    }
  }

  return out;
};

export const emptyFilters = (): SegmentFilters => ({
  stages: [],
  city: [],
  state: [],
  age_min: null,
  age_max: null,
  status: "",
  channel: "",
});

export const normalizeFilters = (f: SegmentFilters | null | undefined): SegmentFilters => {
  if (!f) return emptyFilters();
  return {
    ...f,
    city: toStrArr(f.city),
    state: toStrArr(f.state),
  };
};

export type TargetingMode = "all" | "audiences" | "segment" | "filters";

export type ContentTargeting = {
  targeting_mode: TargetingMode;
  audience_types: AudienceType[];
  segment_id: string | null;
  filters: SegmentFilters;
};

export const ALL_AUDIENCES: AudienceType[] = ["paciente", "familiar", "cuidador", "medico"];

/**
 * Resolve the (audience_types, filters) effectively used by a piece of content.
 * If the linked segment was deleted, falls back to "all".
 */
export const resolveContentTargeting = async (
  c: Partial<ContentTargeting> | null | undefined,
): Promise<{ audience_types: AudienceType[]; filters: SegmentFilters; segmentMissing?: boolean }> => {
  const mode = (c?.targeting_mode ?? "all") as TargetingMode;
  if (mode === "all") return { audience_types: ALL_AUDIENCES, filters: emptyFilters() };
  if (mode === "audiences") return { audience_types: c?.audience_types ?? [], filters: emptyFilters() };
  if (mode === "filters") return { audience_types: c?.audience_types ?? [], filters: c?.filters ?? emptyFilters() };
  // segment
  if (!c?.segment_id) return { audience_types: ALL_AUDIENCES, filters: emptyFilters(), segmentMissing: true };
  const { data } = await supabase
    .from("audience_segments")
    .select("audience_types, filters")
    .eq("id", c.segment_id)
    .maybeSingle();
  if (!data) return { audience_types: ALL_AUDIENCES, filters: emptyFilters(), segmentMissing: true };
  return {
    audience_types: (data.audience_types as AudienceType[]) ?? [],
    filters: (data.filters as SegmentFilters) ?? emptyFilters(),
  };
};