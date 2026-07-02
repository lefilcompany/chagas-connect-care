import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// Avoid the real UseTemplateDialog: it queries supabase + auth on open which
// hangs in unit tests. We only need to assert the dialog opens with the
// selected template name.
vi.mock("@/components/app/messages/UseTemplateDialog", () => ({
  UseTemplateDialog: ({ open, template }: any) =>
    open && template ? (
      <div role="dialog" aria-label={`Usar objetivo: ${template.name}`}>
        stub
      </div>
    ) : null,
}));

import MessageTemplates from "./MessageTemplates";
import {
  InstitutionTemplateServiceContext,
  InstitutionIdentityContext,
  type InstitutionTemplateService,
  type InstitutionIdentity,
} from "@/services/institutionTemplates";
import type { MessageTemplate, MetaStatus } from "@/lib/templates";

function makeTemplate(over: Partial<MessageTemplate> = {}): MessageTemplate {
  return {
    id: over.id ?? "t1",
    name: "Lembrete de consulta",
    description: "Envia lembrete de consulta ao paciente",
    category: "consulta",
    body: "Olá {nome_paciente}, sua consulta é amanhã.",
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
    meta_status: "approved" as MetaStatus,
    institution: "Inst A",
    created_by: null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
    ...over,
  } as MessageTemplate;
}

type RenderOpts = {
  templates?: MessageTemplate[];
  identity?: Partial<InstitutionIdentity>;
  serviceOverride?: Partial<InstitutionTemplateService>;
};

function renderPage(opts: RenderOpts = {}) {
  const identity: InstitutionIdentity = {
    institution: "Inst A",
    isAdmin: false,
    loading: false,
    error: null,
    ...(opts.identity ?? {}),
  };
  const templates = opts.templates ?? [];
  const service: InstitutionTemplateService = {
    list: vi.fn(async (institution: string) =>
      templates.filter((t) => t.institution === institution),
    ),
    getById: vi.fn(async () => null),
    createDraft: vi.fn(async () => ({} as any)),
    updateDraft: vi.fn(async () => ({} as any)),
    submitToMeta: vi.fn(async () => ({ meta_template_id: "m", meta_status: "submitted", submitted_at: "2026-07-02T00:00:00.000Z" })),
    syncFromMeta: vi.fn(async () => ({ meta_status: "submitted", updated: 0, matched: 0 })),
    uploadHeaderMedia: vi.fn(async () => ({ header_handle: "HDL", format: "IMAGE" as const, media_id: "m" })),
    ...opts.serviceOverride,
  };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <InstitutionIdentityContext.Provider value={identity}>
          <InstitutionTemplateServiceContext.Provider value={service}>
            <MessageTemplates />
          </InstitutionTemplateServiceContext.Provider>
        </InstitutionIdentityContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...utils, service };
}

describe("MessageTemplates page", () => {
  it("lists templates from the authenticated user's institution", async () => {
    renderPage({
      templates: [
        makeTemplate({ id: "1", name: "Boas-vindas", institution: "Inst A" }),
        makeTemplate({ id: "2", name: "Modelo de outra clínica", institution: "Inst B" }),
      ],
    });
    expect(await screen.findByText("Boas-vindas")).toBeInTheDocument();
    expect(screen.queryByText("Modelo de outra clínica")).not.toBeInTheDocument();
  });

  it("filters the list by search term", async () => {
    renderPage({
      templates: [
        makeTemplate({ id: "1", name: "Lembrete de consulta" }),
        makeTemplate({ id: "2", name: "Boas-vindas" }),
      ],
    });
    await screen.findByText("Lembrete de consulta");
    fireEvent.change(screen.getByPlaceholderText(/Buscar por nome/i), {
      target: { value: "boas" },
    });
    expect(screen.getByText("Boas-vindas")).toBeInTheDocument();
    expect(screen.queryByText("Lembrete de consulta")).not.toBeInTheDocument();
  });

  it("filters the list by status", async () => {
    renderPage({
      templates: [
        makeTemplate({ id: "1", name: "Modelo Alfa", meta_status: "approved" }),
        makeTemplate({ id: "2", name: "Modelo Bravo", meta_status: "submitted" }),
      ],
    });
    await screen.findByText("Modelo Alfa");
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "submitted" } });
    expect(screen.getByText("Modelo Bravo")).toBeInTheDocument();
    expect(screen.queryByText("Modelo Alfa")).not.toBeInTheDocument();
  });

  it("enables 'Usar modelo' for approved Meta templates", async () => {
    renderPage({
      templates: [makeTemplate({ name: "Modelo Alfa", meta_status: "approved" })],
    });
    const button = await screen.findByRole("button", { name: /Usar modelo Modelo Alfa/ });
    expect(button).toBeEnabled();
  });

  it("does not allow sending non-approved Meta templates", async () => {
    renderPage({
      templates: [makeTemplate({ name: "Modelo Bravo", meta_status: "submitted" })],
    });
    const button = await screen.findByRole("button", { name: /Usar modelo Modelo Bravo/ });
    expect(button).toBeDisabled();
  });

  it("opens the Use Template dialog when clicking 'Usar modelo' on an approved template", async () => {
    renderPage({
      templates: [makeTemplate({ name: "Modelo Charlie", meta_status: "approved" })],
    });
    const button = await screen.findByRole("button", { name: /Usar modelo Modelo Charlie/ });
    fireEvent.click(button);
    expect(
      await screen.findByRole("dialog", { name: /Usar objetivo: Modelo Charlie/i }),
    ).toBeInTheDocument();
  });

  it("shows a distinct disabled reason for rejected templates", async () => {
    renderPage({
      templates: [makeTemplate({ name: "Modelo Delta", meta_status: "rejected" })],
    });
    const button = await screen.findByRole("button", { name: /Usar modelo Modelo Delta/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", expect.stringMatching(/Rejeitado/i));
  });

  it("shows the admin management hint only for admins", async () => {
    const { unmount } = renderPage({
      templates: [makeTemplate()],
      identity: { isAdmin: true },
    });
    expect(await screen.findByText(/Em breve: criar e submeter modelos/i)).toBeInTheDocument();
    unmount();

    renderPage({
      templates: [makeTemplate()],
      identity: { isAdmin: false },
    });
    expect(screen.queryByText(/Em breve: criar e submeter modelos/i)).not.toBeInTheDocument();
  });

  it("shows an empty-state message when the institution has no templates", async () => {
    renderPage({ templates: [] });
    expect(await screen.findByText(/Nenhum modelo encontrado/i)).toBeInTheDocument();
  });

  it("shows a retry action when the service fails and recovers on retry", async () => {
    const listMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce([makeTemplate({ name: "Recuperado" })]);
    renderPage({ serviceOverride: { list: listMock } });
    const retry = await screen.findByRole("button", { name: /Tentar novamente/i });
    fireEvent.click(retry);
    await waitFor(() =>
      expect(screen.getByText("Recuperado")).toBeInTheDocument(),
    );
  });
});