import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MessageTemplateNew from "./MessageTemplateNew";
import MessageTemplates from "./MessageTemplates";
import {
  InstitutionTemplateServiceContext,
  InstitutionIdentityContext,
  type InstitutionTemplateService,
  type InstitutionIdentity,
} from "@/services/institutionTemplates";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}));

function renderAt(
  path: string,
  {
    identity,
    service,
  }: { identity: InstitutionIdentity; service: InstitutionTemplateService },
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <InstitutionIdentityContext.Provider value={identity}>
          <InstitutionTemplateServiceContext.Provider value={service}>
            <Routes>
              <Route path="/app/modelos" element={<MessageTemplates />} />
              <Route path="/app/modelos/novo" element={<MessageTemplateNew />} />
            </Routes>
          </InstitutionTemplateServiceContext.Provider>
        </InstitutionIdentityContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const adminIdentity: InstitutionIdentity = {
  institution: "Inst A",
  isAdmin: true,
  loading: false,
  error: null,
};

const commonIdentity: InstitutionIdentity = {
  institution: "Inst A",
  isAdmin: false,
  loading: false,
  error: null,
};

function makeService(
  overrides: Partial<InstitutionTemplateService> = {},
): InstitutionTemplateService {
  return {
    list: vi.fn(async () => []),
    getById: vi.fn(async () => null),
    createDraft: vi.fn(async (input, ctx) => ({
      id: "new-1",
      name: input.name,
      description: input.description ?? "",
      category: input.category,
      body: input.body,
      variables: [],
      targeting_mode: "all",
      audience_types: [],
      segment_id: null,
      filters: {} as any,
      channel: "whatsapp",
      template_kind: input.template_kind,
      meta_template_name: input.meta_template_name,
      meta_template_id: null,
      meta_language: input.meta_language,
      meta_category: input.meta_category,
      meta_status: "not_submitted",
      institution: ctx.institution,
      created_by: ctx.userId,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }) as any),
    updateDraft: vi.fn(async () => ({} as any)),
    submitToMeta: vi.fn(async () => ({ meta_template_id: "m", meta_status: "submitted", submitted_at: "2026-07-02T00:00:00.000Z" })),
    syncFromMeta: vi.fn(async () => ({ meta_status: "submitted", updated: 0, matched: 0 })),
    uploadHeaderMedia: vi.fn(async () => ({ header_handle: "HDL", format: "IMAGE" as const, media_id: "m" })),
    ...overrides,
  };
}

describe("MessageTemplateNew", () => {
  it("admin creates a Meta draft and returns to list with 'Rascunho' badge", async () => {
    const created: any[] = [];
    const service = makeService({
      list: vi.fn(async () => created),
      createDraft: vi.fn(async (input, ctx) => {
        const t = {
          id: "t-1",
          name: input.name,
          description: "",
          category: input.category,
          body: input.body,
          variables: [],
          targeting_mode: "all" as const,
          audience_types: [],
          segment_id: null,
          filters: {} as any,
          channel: "whatsapp" as const,
          template_kind: input.template_kind,
          meta_template_name: input.meta_template_name,
          meta_template_id: null,
          meta_language: input.meta_language,
          meta_category: input.meta_category,
          meta_status: "not_submitted" as const,
          institution: ctx.institution,
          created_by: ctx.userId,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        created.push(t);
        return t as any;
      }),
    });
    renderAt("/app/modelos/novo", { identity: adminIdentity, service });

    fireEvent.change(screen.getByLabelText("Nome local"), {
      target: { value: "Confirmação de consulta" },
    });
    fireEvent.change(screen.getByLabelText("Nome técnico Meta"), {
      target: { value: "confirmacao_consulta" },
    });
    fireEvent.change(screen.getByLabelText("Corpo"), {
      target: { value: "Olá, sua consulta está confirmada." },
    });

    fireEvent.click(screen.getByRole("button", { name: /Salvar rascunho/i }));

    await waitFor(() => expect(service.createDraft).toHaveBeenCalled());
    const [payload, ctx] = (service.createDraft as any).mock.calls[0];
    expect(payload).not.toHaveProperty("meta_status");
    expect(payload).not.toHaveProperty("institution");
    expect(ctx.institution).toBe("Inst A");
    expect(ctx.userId).toBe("user-1");

    // Redirected to list and the new draft appears
    expect(await screen.findByText("Confirmação de consulta")).toBeInTheDocument();
  });

  it("redirects non-admin users away from /app/modelos/novo", () => {
    const service = makeService();
    renderAt("/app/modelos/novo", { identity: commonIdentity, service });
    // Redirected to /app/modelos which shows the catalog header.
    expect(screen.getByRole("heading", { name: /Modelos de mensagem/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Salvar rascunho/i })).not.toBeInTheDocument();
  });

  it("does not show 'Novo modelo' button for non-admins", () => {
    const service = makeService();
    renderAt("/app/modelos", { identity: commonIdentity, service });
    expect(screen.queryByRole("link", { name: /Novo modelo/i })).not.toBeInTheDocument();
  });

  it("blocks submit when the body is empty", async () => {
    const service = makeService();
    renderAt("/app/modelos/novo", { identity: adminIdentity, service });
    fireEvent.change(screen.getByLabelText("Nome local"), {
      target: { value: "Sem corpo" },
    });
    fireEvent.change(screen.getByLabelText("Nome técnico Meta"), {
      target: { value: "sem_corpo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Salvar rascunho/i }));
    await waitFor(() =>
      expect(
        screen.getByText(/O corpo da mensagem não pode ficar vazio/i),
      ).toBeInTheDocument(),
    );
    expect(service.createDraft).not.toHaveBeenCalled();
  });

  it("blocks submit when a variable has no example", async () => {
    const service = makeService();
    renderAt("/app/modelos/novo", { identity: adminIdentity, service });
    fireEvent.change(screen.getByLabelText("Nome local"), {
      target: { value: "Com variavel" },
    });
    fireEvent.change(screen.getByLabelText("Nome técnico Meta"), {
      target: { value: "com_variavel" },
    });
    fireEvent.change(screen.getByLabelText("Corpo"), {
      target: { value: "Olá {nome_paciente}" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Salvar rascunho/i }));
    await waitFor(() =>
      expect(screen.getByText(/Informe um exemplo para \{nome_paciente\}/i)).toBeInTheDocument(),
    );
    expect(service.createDraft).not.toHaveBeenCalled();
  });

  it("shows an error when Meta name is invalid", async () => {
    const service = makeService();
    renderAt("/app/modelos/novo", { identity: adminIdentity, service });
    fireEvent.change(screen.getByLabelText("Nome local"), {
      target: { value: "Nome inválido" },
    });
    fireEvent.change(screen.getByLabelText("Nome técnico Meta"), {
      target: { value: "Foo Bar!" },
    });
    fireEvent.change(screen.getByLabelText("Corpo"), {
      target: { value: "Olá, tudo bem?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Salvar rascunho/i }));
    await waitFor(() =>
      expect(screen.getByText(/Use apenas letras minúsculas/i)).toBeInTheDocument(),
    );
    expect(service.createDraft).not.toHaveBeenCalled();
  });

  it("does not expose a status Select control", () => {
    const service = makeService();
    renderAt("/app/modelos/novo", { identity: adminIdentity, service });
    // no select/combobox labelled as status inside the form
    expect(screen.queryByLabelText(/^Status$/i)).not.toBeInTheDocument();
  });
});
