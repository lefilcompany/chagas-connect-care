import { supabase } from "@/integrations/supabase/client";

export type AudienceType = "paciente" | "familiar" | "cuidador" | "medico";

export type SegmentFilters = {
  stages?: string[];
  city?: string;
  state?: string;
  age_min?: number | null;
  age_max?: number | null;
  status?: "ativo" | "inativo" | "";
  channel?: "whatsapp" | "sms" | "";
  institution?: string;
};

export type SegmentDef = {
  id: string;
  name: string;
  description: string;
  audience_types: AudienceType[];
  filters: SegmentFilters;
  owner_id?: string | null;
  institution?: string;
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

const matchesCommon = (
  row: { city?: string | null; state?: string | null; status?: string | null; channel_pref?: string | null; birth_date?: string | null },
  f: SegmentFilters,
): boolean => {
  if (f.city && !norm(row.city).includes(norm(f.city))) return false;
  if (f.state && norm(row.state) !== norm(f.state)) return false;
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
    .select("id, full_name, phone, channel_pref, stage, city, state, status, birth_date, institution");
  const patients = patientsData ?? [];

  const matchPatient = (p: any) => {
    if (f_active.stages?.length && !f_active.stages.includes(p.stage)) return false;
    if (f_active.institution && !norm(p.institution).includes(norm(f_active.institution))) return false;
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
      // patient-level filters (stage, institution) still apply via parent
      if (f_active.stages?.length && !f_active.stages.includes(parent.stage)) continue;
      if (f_active.institution && !norm(parent.institution).includes(norm(f_active.institution))) continue;
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
  city: "",
  state: "",
  age_min: null,
  age_max: null,
  status: "",
  channel: "",
  institution: "",
});