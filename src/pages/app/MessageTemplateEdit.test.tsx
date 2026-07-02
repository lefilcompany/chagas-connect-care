import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MessageTemplateEdit from "./MessageTemplateEdit";
import MessageTemplates from "./MessageTemplates";
import {
  InstitutionTemplateServiceContext,
  InstitutionIdentityContext,
  type InstitutionTemplateService,
  type InstitutionIdentity,
} from "@/services/institutionTemplates";
import type { MessageTemplate, MetaStatus } from "@/lib/templates";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}));

const adminIdentity: InstitutionIdentity = {
  institution: "Inst A",
  isAdmin: true,
  loading: false,
  error: null,
};

function makeTemplate(over: Partial<MessageTemplate> = {}): MessageTemplate {
  return {
    id: "t-1",
    name: "Lembrete",
    description: "",
    category: "consulta",
    body: "Olá {nome_paciente}",
    variables: ["nome_paciente"],
    targeting_mode: "all",
    audience_types: [],
    segment_id: null,
    filters: {} as any,
    channel: "whatsapp",
    template_kind: "meta",
    meta_template_name: "lembrete",
    meta_template_id: null,
    meta_language: "pt_BR",
    meta_category: "UTILITY",
    meta_status: "not_submitted" as MetaStatus,
    institution: "Inst A",
    created_by: "user-1",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  } as MessageTemplate;
}

function renderAt(
  path: string,
  service: InstitutionTemplateService,
  identity: InstitutionIdentity = adminIdentity,
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <InstitutionIdentityContext.Provider value={identity}>
          <InstitutionTemplateServiceContext.Provider value={service}>
            <Routes>
              <Route path="/app/modelos" element={<MessageTemplates />} />
              <Route path="/app/modelos/:templateId" element={<MessageTemplateEdit />} />
            </Routes>
          </InstitutionTemplateServiceContext.Provider>
        </InstitutionIdentityContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MessageTemplateEdit", () => {
  it("loads an existing draft and lets the admin save changes", async () => {
    const draft = makeTemplate();
    const service: InstitutionTemplateService = {
      list: vi.fn(async () => [draft]),
      getById: vi.fn(async () => draft),
      createDraft: vi.fn(),
      updateDraft: vi.fn(async (id, input) => ({ ...draft, id, ...input } as any)),
    };
    renderAt("/app/modelos/t-1", service);

    const name = await screen.findByLabelText("Nome local");
    expect((name as HTMLInputElement).value).toBe("Lembrete");
    // fill required example for variable {nome_paciente}
    fireEvent.change(screen.getByLabelText(/Nome do paciente/), {
      target: { value: "Maria" },
    });
    fireEvent.change(name, { target: { value: "Lembrete v2" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar rascunho/i }));

    await waitFor(() => expect(service.updateDraft).toHaveBeenCalled());
    const [id, payload] = (service.updateDraft as any).mock.calls[0];
    expect(id).toBe("t-1");
    expect(payload.name).toBe("Lembrete v2");
    expect(payload).not.toHaveProperty("meta_status");
    expect(payload).not.toHaveProperty("institution");
  });

  it("blocks editing when the template is already approved", async () => {
    const approved = makeTemplate({ id: "t-2", meta_status: "approved" });
    const service: InstitutionTemplateService = {
      list: vi.fn(async () => [approved]),
      getById: vi.fn(async () => approved),
      createDraft: vi.fn(),
      updateDraft: vi.fn(),
    };
    renderAt("/app/modelos/t-2", service);

    expect(
      await screen.findByText(/já foi enviado à Meta/i),
    ).toBeInTheDocument();
    const save = screen.getByRole("button", { name: /Salvar rascunho/i });
    expect(save).toBeDisabled();
  });

  it("redirects non-admins away from /app/modelos/:id", async () => {
    const service: InstitutionTemplateService = {
      list: vi.fn(async () => []),
      getById: vi.fn(async () => makeTemplate()),
      createDraft: vi.fn(),
      updateDraft: vi.fn(),
    };
    renderAt("/app/modelos/t-1", service, {
      ...adminIdentity,
      isAdmin: false,
    });
    // Ends up on catalog
    expect(
      screen.getByRole("heading", { name: /Modelos de mensagem/i }),
    ).toBeInTheDocument();
  });
});
