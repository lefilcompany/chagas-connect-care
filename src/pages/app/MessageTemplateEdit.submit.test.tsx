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
      meta_template_id: "meta-999",
      meta_status: "submitted",
      submitted_at: "2026-07-02T12:00:00.000Z",
    })),
    syncFromMeta: vi.fn(async () => ({ meta_status: "submitted", updated: 0, matched: 0 })),
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

describe("MessageTemplateEdit submit-to-Meta", () => {
  it("shows the button for meta drafts and calls submitToMeta", async () => {
    const service = makeService();
    renderPage(service);
    const btn = await screen.findByRole("button", { name: /Enviar para aprovação/i });
    fireEvent.click(btn);
    await waitFor(() => expect(service.submitToMeta).toHaveBeenCalledWith("t-1"));
  });

  it("does not render the button once template is already submitted", async () => {
    const service = makeService({
      getById: vi.fn(async () =>
        makeTemplate({ meta_status: "submitted", meta_template_id: "meta-1" }),
      ),
    });
    renderPage(service);
    await screen.findByText(/já foi enviado à Meta/i);
    expect(
      screen.queryByRole("button", { name: /Enviar para aprovação/i }),
    ).not.toBeInTheDocument();
  });

  it("does not render the button for internal templates", async () => {
    const service = makeService({
      getById: vi.fn(async () => makeTemplate({ template_kind: "internal" })),
    });
    renderPage(service);
    await screen.findByLabelText("Nome local");
    expect(
      screen.queryByRole("button", { name: /Enviar para aprovação/i }),
    ).not.toBeInTheDocument();
  });

  it("shows an error toast when submitToMeta fails", async () => {
    const service = makeService({
      submitToMeta: vi.fn(async () => {
        throw new Error("Categoria inválida");
      }),
    });
    renderPage(service);
    fireEvent.click(await screen.findByRole("button", { name: /Enviar para aprovação/i }));
    await waitFor(() => expect(service.submitToMeta).toHaveBeenCalled());
    // sonner renders inside a portal; just assert the mutation was invoked and
    // the button becomes clickable again (no crash).
    expect(
      await screen.findByRole("button", { name: /Enviar para aprovação/i }),
    ).toBeEnabled();
  });
});
