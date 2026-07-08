import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: fromMock },
}));

import {
  ALL_AUDIENCES,
  emptyFilters,
  normalizeFilters,
  resolveContentTargeting,
  resolveRecipients,
} from "@/lib/segments";

const patients = [
  {
    id: "p1",
    full_name: "Ana Paciente",
    phone: "5511999999999",
    channel_pref: "whatsapp",
    stage: "cronico",
    city: "Recife",
    state: "PE",
    status: "ativo",
    birth_date: "1980-01-01",
  },
  {
    id: "p2",
    full_name: "Bia Paciente",
    phone: "5511888888888",
    channel_pref: "sms",
    stage: "agudo",
    city: "Olinda",
    state: "PE",
    status: "inativo",
    birth_date: "1990-01-01",
  },
];

const contacts = [
  {
    id: "c1",
    patient_id: "p1",
    full_name: "Carlos Familiar",
    phone: "5511777777777",
    channel_pref: "whatsapp",
    relation: "familiar",
    city: "Recife",
    state: "PE",
    status: "ativo",
    birth_date: "1975-01-01",
  },
  {
    id: "c2",
    patient_id: "p2",
    full_name: "Dora Cuidadora",
    phone: "5511666666666",
    channel_pref: "sms",
    relation: "cuidador",
    city: "Olinda",
    state: "PE",
    status: "ativo",
    birth_date: "1985-01-01",
  },
];

function mockTableData(segmentData: unknown = null) {
  fromMock.mockImplementation((table: string) => {
    if (table === "patients") {
      return { select: vi.fn().mockResolvedValue({ data: patients, error: null }) };
    }
    if (table === "contacts") {
      return { select: vi.fn().mockResolvedValue({ data: contacts, error: null }) };
    }
    if (table === "audience_segments") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: segmentData, error: null }),
          })),
        })),
      };
    }
    throw new Error(`Tabela não mockada: ${table}`);
  });
}

describe("segments", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("normaliza filtros vazios, arrays e JSON serializado", () => {
    expect(normalizeFilters(null)).toEqual(emptyFilters());
    expect(normalizeFilters({ city: "Recife", stages: "[\"cronico\"]", patient_ids: ["p1"] }))
      .toMatchObject({ city: ["Recife"], stages: ["cronico"], patient_ids: ["p1"] });
    expect(normalizeFilters("{\"state\":[\"PE\"]}")).toMatchObject({ state: ["PE"] });
    expect(normalizeFilters("json-invalido")).toEqual(emptyFilters());
  });

  it("retorna vazio quando nenhuma audiência foi selecionada", async () => {
    await expect(resolveRecipients([], emptyFilters())).resolves.toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("resolve pacientes e contatos vinculados com chaves estáveis", async () => {
    mockTableData();

    const recipients = await resolveRecipients(["paciente", "familiar"], {
      ...emptyFilters(),
      patient_ids: ["p1"],
    });

    expect(recipients).toEqual([
      expect.objectContaining({ key: "p:p1", kind: "patient", name: "Ana Paciente", relation: "paciente" }),
      expect.objectContaining({ key: "c:c1", kind: "contact", name: "Carlos Familiar", relation: "familiar" }),
    ]);
  });

  it("aplica filtros de estágio, cidade, estado, status e canal", async () => {
    mockTableData();

    const recipients = await resolveRecipients(["paciente", "cuidador"], {
      stages: ["agudo"],
      city: ["olin"],
      state: ["pe"],
      status: "inativo",
      channel: "sms",
      patient_ids: [],
    });

    expect(recipients).toHaveLength(1);
    expect(recipients[0]).toMatchObject({ key: "p:p2", name: "Bia Paciente" });
  });

  it("resolve modos all, audiences e filters sem consultar o banco", async () => {
    await expect(resolveContentTargeting({ targeting_mode: "all" }))
      .resolves.toEqual({ audience_types: ALL_AUDIENCES, filters: emptyFilters() });
    await expect(resolveContentTargeting({
      targeting_mode: "audiences",
      audience_types: ["paciente"],
      segment_id: null,
      filters: emptyFilters(),
    })).resolves.toEqual({ audience_types: ["paciente"], filters: emptyFilters() });
    await expect(resolveContentTargeting({
      targeting_mode: "filters",
      audience_types: ["cuidador"],
      segment_id: null,
      filters: { state: ["PE"] },
    })).resolves.toEqual({ audience_types: ["cuidador"], filters: { state: ["PE"] } });

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("usa o segmento persistido e sinaliza quando ele não existe", async () => {
    mockTableData({ audience_types: ["familiar"], filters: { city: ["Recife"] } });
    await expect(resolveContentTargeting({
      targeting_mode: "segment",
      audience_types: [],
      segment_id: "s1",
      filters: emptyFilters(),
    })).resolves.toEqual({ audience_types: ["familiar"], filters: { city: ["Recife"] } });

    fromMock.mockReset();
    mockTableData(null);
    await expect(resolveContentTargeting({
      targeting_mode: "segment",
      audience_types: [],
      segment_id: "inexistente",
      filters: emptyFilters(),
    })).resolves.toEqual({
      audience_types: ALL_AUDIENCES,
      filters: emptyFilters(),
      segmentMissing: true,
    });
  });
});
