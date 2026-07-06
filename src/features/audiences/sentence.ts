import type { AudienceType, SegmentDef, SegmentFilters } from "@/lib/segments";
import { AUDIENCE_LABELS } from "@/lib/segments";

const STAGE_LABEL: Record<string, string> = {
  diagnostico: "recém-diagnosticadas",
  agudo: "em fase aguda",
  cronico: "em acompanhamento crônico",
};

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "com preferência por WhatsApp",
  sms: "com preferência por SMS",
};

function joinPt(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} e ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/** Turns an audience segment into a natural-language Portuguese sentence. */
export function segmentSentence(segment: Pick<SegmentDef, "audience_types" | "filters">): string {
  const parts: string[] = [];
  const audiences = segment.audience_types ?? [];
  const audienceText = audiences.length
    ? joinPt(audiences.map((a) => AUDIENCE_LABELS[a as AudienceType].toLowerCase()))
    : "pessoas";
  parts.push(audienceText);

  const f = segment.filters ?? ({} as SegmentFilters);
  const stages = (f.stages ?? []).map((s) => STAGE_LABEL[s] ?? s).filter(Boolean);
  if (stages.length) parts.push(joinPt(stages));

  const cities = f.city ?? [];
  const states = f.state ?? [];
  if (cities.length) parts.push(`em ${joinPt(cities)}`);
  else if (states.length) parts.push(`em ${joinPt(states)}`);

  if (f.age_min != null && f.age_max != null) parts.push(`entre ${f.age_min} e ${f.age_max} anos`);
  else if (f.age_min != null) parts.push(`com ${f.age_min}+ anos`);
  else if (f.age_max != null) parts.push(`com até ${f.age_max} anos`);

  if (f.status === "ativo") parts.push("com cadastro ativo");
  else if (f.status === "inativo") parts.push("com cadastro inativo");

  if (f.channel && CHANNEL_LABEL[f.channel]) parts.push(CHANNEL_LABEL[f.channel]);

  if (f.patient_ids?.length) parts.push(`limitadas a ${f.patient_ids.length} pessoa(s) selecionada(s)`);

  return parts.join(", ") + ".";
}