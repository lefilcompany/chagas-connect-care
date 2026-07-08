import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, invokeMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  invokeMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
    functions: { invoke: invokeMock },
  },
}));

import {
  createBatch,
  formatWindowLabel,
  friendlyWhatsAppError,
  getWindowStatus,
  queueAndSend,
  sendBatch,
} from "@/lib/whatsapp";

function mockMessageInsert(result: { data: { id: string } | null; error: { message: string } | null }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const insert = vi.fn(() => ({ select }));
  fromMock.mockImplementation((table: string) => {
    if (table !== "messages") throw new Error(`Tabela inesperada: ${table}`);
    return { insert };
  });
  return { insert, select, maybeSingle };
}

describe("whatsapp", () => {
  beforeEach(() => {
    fromMock.mockReset();
    invokeMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("traduz erros estruturados para mensagens orientadas ao usuário", () => {
    expect(friendlyWhatsAppError({ error_code: "SERVICE_WINDOW_CLOSED" }))
      .toContain("Janela de atendimento de 24h encerrada");
    expect(friendlyWhatsAppError({ error_code: "WHATSAPP_OPT_OUT_ACTIVE" }))
      .toContain("opt-out");
    expect(friendlyWhatsAppError({ error_code: "TEMPLATE_PARAMETER_MISSING", error: "Variável nome ausente" }))
      .toBe("Variável nome ausente");
    expect(friendlyWhatsAppError({
      error_code: "META_API_ERROR",
      meta_error: { code: 131026, message: "Undeliverable" },
    })).toContain("não tem WhatsApp ativo");
    expect(friendlyWhatsAppError({ error: "Falha específica" })).toBe("Falha específica");
  });

  it("calcula e formata janela nunca aberta, encerrada e aberta", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T12:00:00.000Z"));

    expect(getWindowStatus(null)).toEqual({ state: "never" });
    expect(formatWindowLabel(getWindowStatus(null))).toContain("Nenhuma conversa iniciada");

    const closed = getWindowStatus("2026-07-08T11:59:00.000Z");
    expect(closed.state).toBe("closed");
    expect(formatWindowLabel(closed)).toContain("Janela encerrada");

    const open = getWindowStatus("2026-07-08T13:30:00.000Z");
    expect(open).toMatchObject({ state: "open", remainingMinutes: 90 });
    expect(formatWindowLabel(open)).toContain("1h 30m restantes");

    vi.useRealTimers();
  });

  it("registra SMS em fila sem invocar a função WhatsApp", async () => {
    const chain = mockMessageInsert({ data: { id: "m-sms" }, error: null });

    await expect(queueAndSend({
      patient_id: "p1",
      body: "Lembrete",
      channel: "sms",
    })).resolves.toEqual({ message_id: "m-sms", ok: true });

    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      channel: "sms",
      direction: "outbound",
      status: "queued",
      body: "Lembrete",
    }));
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("registra e envia WhatsApp retornando o id externo", async () => {
    mockMessageInsert({ data: { id: "m1" }, error: null });
    invokeMock.mockResolvedValue({
      data: { ok: true, external_message_id: "wamid.123" },
      error: null,
    });

    await expect(queueAndSend({ patient_id: "p1", body: "Olá" })).resolves.toEqual({
      message_id: "m1",
      ok: true,
      external_message_id: "wamid.123",
    });
    expect(invokeMock).toHaveBeenCalledWith("send-whatsapp", { body: { message_id: "m1" } });
  });

  it("retorna erro quando não consegue persistir a mensagem", async () => {
    mockMessageInsert({ data: null, error: { message: "RLS bloqueou" } });

    await expect(queueAndSend({ patient_id: "p1", body: "Olá" })).resolves.toEqual({
      message_id: null,
      ok: false,
      error: "RLS bloqueou",
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("propaga erro estruturado retornado pela edge function", async () => {
    mockMessageInsert({ data: { id: "m2" }, error: null });
    invokeMock.mockResolvedValue({
      data: { ok: false, error_code: "WHATSAPP_OPT_IN_REQUIRED" },
      error: null,
    });

    const result = await queueAndSend({ patient_id: "p1", body: "Olá" });
    expect(result).toMatchObject({
      message_id: "m2",
      ok: false,
      error_code: "WHATSAPP_OPT_IN_REQUIRED",
    });
    expect(result.error).toContain("ainda não autorizou");
  });

  it("processa lote com sucesso e falha sem exceder três mensagens de erro", async () => {
    invokeMock
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
      .mockResolvedValueOnce({ data: { ok: false, error: "Falha 1" }, error: null })
      .mockRejectedValueOnce(new Error("Falha 2"))
      .mockResolvedValueOnce({ data: { ok: false, error: "Falha 3" }, error: null })
      .mockResolvedValueOnce({ data: { ok: false, error: "Falha 4" }, error: null });

    await expect(sendBatch(["1", "2", "3", "4", "5"], 1)).resolves.toEqual({
      ok: 1,
      failed: 4,
      errors: ["Falha 1", "Falha 2", "Falha 3"],
    });
  });

  it("recusa criação de lote sem destinatários antes de acessar o banco", async () => {
    await expect(createBatch({
      name: "Lote vazio",
      body: "Mensagem",
      recipients: [],
      targeting_mode: "all",
      audience_types: [],
    })).resolves.toEqual({
      batch_id: null,
      ok: false,
      error: "Nenhum destinatário selecionado",
    });
    expect(fromMock).not.toHaveBeenCalled();
  });
});
