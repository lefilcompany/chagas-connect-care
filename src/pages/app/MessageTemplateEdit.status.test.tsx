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

vi.mock("@/integrations/supabase/client", () => {
  const channel = {
    on: () => channel,
    subscribe: () => channel,
  };
  return {
    supabase: {
      channel: () => channel,
      removeChannel: () => {},
    },
  };
});

const identity: InstitutionIdentity = {
  institution: "Inst A", isAdmin: true, loading: false, error: null,
};

function makeTemplate(over: Partial<MessageTemplate> = {}): MessageTemplate {
  return {
    id: "t-1", name: "Lembrete", description: "", category: "geral",
    body: "Olá {nome_paciente}", variables: ["nome_paciente"],
    targeting_mode: "all", audience_types: [], segment_id: null,
    filters: {} as never, channel: "whatsapp",
    template_kind: "meta", meta_template_name: "lembrete", meta_template_id: "meta-999",
    meta_language: "pt_BR", meta_category: "UTILITY", meta_status: "submitted",
    institution: "Inst A", created_by: "user-1", is_active: true,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    ...over,
  } as MessageTemplate;
}

function makeService(tpl: MessageTemplate, over: Partial<InstitutionTemplateService> = {}): InstitutionTemplateService {
  return {
    list: vi.fn(async () => []),
    getById: vi.fn(async () => tpl),
    createDraft: vi.fn(),
    updateDraft: vi.fn(),
    submitToMeta: vi.fn(),
    syncFromMeta: vi.fn(async () => ({ meta_status: "approved", updated: 1, matched: 1 })),
    uploadHeaderMedia: vi.fn(async () => ({ header_handle: "HDL", format: "IMAGE" as const, media_id: "m" })),
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

describe("MessageTemplateEdit status panel", () => {
  it('renders "Em análise" badge and "Atualizar status" button when submitted', async () => {
    renderPage(makeService(makeTemplate()));
    await screen.findByRole("region", { name: /status na meta/i });
    expect(screen.getAllByText(/em análise/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /atualizar status/i })).toBeInTheDocument();
  });

  it("calls syncFromMeta when Atualizar status is clicked", async () => {
    const service = makeService(makeTemplate());
    renderPage(service);
    fireEvent.click(await screen.findByRole("button", { name: /atualizar status/i }));
    await waitFor(() => expect(service.syncFromMeta).toHaveBeenCalledWith("t-1"));
  });

  it("shows rejection reason when rejected", async () => {
    const tpl = makeTemplate({
      meta_status: "rejected",
      meta_rejection_reason: "INVALID_FORMAT",
    } as Partial<MessageTemplate>);
    renderPage(makeService(tpl));
    await screen.findByRole("region", { name: /status na meta/i });
    expect(screen.getByText(/INVALID_FORMAT/)).toBeInTheDocument();
  });
});
