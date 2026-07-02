import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MessageTemplateEdit from "./MessageTemplateEdit";
import {
  InstitutionTemplateServiceContext,
  InstitutionIdentityContext,
  type InstitutionTemplateService,
  type InstitutionIdentity,
} from "@/services/institutionTemplates";
import type { MessageTemplate } from "@/lib/templates";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}));

const identity: InstitutionIdentity = {
  institution: "Inst A", isAdmin: true, loading: false, error: null,
};

function makeTemplate(over: Partial<MessageTemplate> = {}): MessageTemplate {
  return {
    id: "t-1", name: "Lembrete", description: "", category: "geral",
    body: "Olá {nome_paciente}", variables: ["nome_paciente"],
    targeting_mode: "all", audience_types: [], segment_id: null,
    filters: {} as never, channel: "whatsapp",
    template_kind: "meta", meta_template_name: "lembrete", meta_template_id: null,
    meta_language: "pt_BR", meta_category: "UTILITY", meta_status: "not_submitted",
    institution: "Inst A", created_by: "user-1", is_active: true,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    ...over,
  } as MessageTemplate;
}

function makeService(over: Partial<InstitutionTemplateService> = {}): InstitutionTemplateService {
  return {
    list: vi.fn(async () => []),
    getById: vi.fn(async () => makeTemplate()),
    createDraft: vi.fn(),
    updateDraft: vi.fn(),
    submitToMeta: vi.fn(async () => ({
      meta_template_id: "meta-999", meta_status: "submitted", submitted_at: null,
    })),
    syncFromMeta: vi.fn(async () => ({ meta_status: "submitted", updated: 0, matched: 0 })),
    uploadHeaderMedia: vi.fn(async () => ({
      header_handle: "HDL-abc", format: "IMAGE" as const, media_id: "media-1",
    })),
    ...over,
  };
}

function renderPage(service: InstitutionTemplateService) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/app/modelos/t-1"]}>
        <InstitutionIdentityContext.Provider value={identity}>
          <InstitutionTemplateServiceContext.Provider value={service}>
            <Routes>
              <Route path="/app/modelos/:templateId" element={<MessageTemplateEdit />} />
            </Routes>
          </InstitutionTemplateServiceContext.Provider>
        </InstitutionIdentityContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MessageTemplateEdit media header", () => {
  it("selecting Imagem + choosing a file calls uploadHeaderMedia and enables submit", async () => {
    const service = makeService();
    renderPage(service);
    // Switch header type to Imagem
    fireEvent.click(await screen.findByText("Imagem"));
    const input = (await screen.findByLabelText(
      "Amostra de mídia do cabeçalho",
    )) as HTMLInputElement;
    const file = new File([new Uint8Array(10)], "amostra.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(service.uploadHeaderMedia).toHaveBeenCalledWith("t-1", file));
    // Handle is displayed
    await screen.findByText(/HDL-abc/);
    // Submit button is now enabled
    const submit = screen.getByRole("button", { name: /Enviar para aprovação/i });
    expect(submit).toBeEnabled();
  });

  it("submit button is disabled when media header has no handle", async () => {
    const service = makeService();
    renderPage(service);
    fireEvent.click(await screen.findByText("Imagem"));
    const submit = await screen.findByRole("button", { name: /Enviar para aprovação/i });
    expect(submit).toBeDisabled();
  });

  it("does not render a manual header media URL input", async () => {
    const service = makeService();
    renderPage(service);
    fireEvent.click(await screen.findByText("Imagem"));
    await screen.findByLabelText("Amostra de mídia do cabeçalho");
    expect(screen.queryByPlaceholderText(/https:\/\//i)).not.toBeInTheDocument();
  });
});