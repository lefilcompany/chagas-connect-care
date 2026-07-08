import { describe, expect, it } from "vitest";
import {
  autofillVariables,
  extractVariables,
  formatMedications,
  getVariableLabel,
  pickVariantBody,
  renderTemplate,
} from "@/lib/templates";

describe("templates", () => {
  it("extrai variáveis únicas preservando a ordem de aparição", () => {
    expect(extractVariables("Olá {nome}, consulta em {data}. Até, {nome}!"))
      .toEqual(["nome", "data"]);
  });

  it("mantém placeholders quando o valor não foi informado", () => {
    expect(renderTemplate("Olá {nome}, sua consulta é {data}", { nome: "Ana", data: "" }))
      .toBe("Olá Ana, sua consulta é {data}");
  });

  it("seleciona a variante solicitada e aplica fallbacks", () => {
    const template = {
      body: "Corpo legado",
      body_patient: "Corpo paciente",
      body_contact: "Corpo contato",
      body_segment: "",
    };

    expect(pickVariantBody(template, "contact")).toBe("Corpo contato");
    expect(pickVariantBody(template, "segment")).toBe("Corpo paciente");
    expect(pickVariantBody({ ...template, body_patient: "" }, "segment")).toBe("Corpo legado");
  });

  it("formata uma medicação e omite campos vazios", () => {
    expect(formatMedications([{ name: "Benznidazol", dose: "100 mg", schedule: "8h" }]))
      .toBe("Benznidazol — 100 mg — 8h");
    expect(formatMedications([{ name: "Benznidazol", dose: null, schedule: "" }]))
      .toBe("Benznidazol");
  });

  it("formata múltiplas medicações em lista ou apenas a primeira", () => {
    const medications = [
      { name: "Medicamento A", dose: "1 comprimido", schedule: "8h" },
      { name: "Medicamento B", dose: "2 comprimidos", schedule: "20h" },
    ];

    expect(formatMedications(medications, "all"))
      .toBe("• Medicamento A — 1 comprimido — 8h\n• Medicamento B — 2 comprimidos — 20h");
    expect(formatMedications(medications, "first"))
      .toBe("Medicamento A — 1 comprimido — 8h");
    expect(formatMedications([])).toBe("");
  });

  it("preenche variáveis comuns com paciente, contato e medicação", () => {
    expect(autofillVariables(
      ["nome_destinatario", "nome_paciente", "nome_contato", "medicacao", "desconhecida"],
      {
        patient: { full_name: "Maria Paciente" },
        contact: { full_name: "Joana Cuidadora" },
        medications: [{ name: "Medicamento A", dose: "10 mg", schedule: "12h" }],
      },
    )).toEqual({
      nome_destinatario: "Joana Cuidadora",
      nome_paciente: "Maria Paciente",
      nome_contato: "Joana Cuidadora",
      medicacao: "Medicamento A — 10 mg — 12h",
    });
  });

  it("usa nome do paciente como destinatário quando não existe contato", () => {
    expect(autofillVariables(["nome_destinatario"], {
      patient: { full_name: "Maria Paciente" },
      contact: null,
    })).toEqual({ nome_destinatario: "Maria Paciente" });
  });

  it("retorna rótulo conhecido ou humaniza chave desconhecida", () => {
    expect(getVariableLabel("nome_paciente")).toContain("Nome do paciente");
    expect(getVariableLabel("data_retorno_especial")).toBe("data retorno especial");
  });
});
