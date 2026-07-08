import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const { authState, accessState } = vi.hoisted(() => ({
  authState: vi.fn(),
  accessState: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => authState(),
}));

vi.mock("@/lib/access", () => ({
  useAccess: () => accessState(),
}));

import { LegacyTechRedirect, RequireSuperAdmin } from "@/components/auth/RequireSuperAdmin";

function CurrentPath() {
  const location = useLocation();
  return <div data-testid="path">{location.pathname}</div>;
}

function renderGuard(initialEntry = "/superadmin") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/superadmin"
          element={(
            <RequireSuperAdmin>
              <div>Área protegida</div>
            </RequireSuperAdmin>
          )}
        />
        <Route path="/auth" element={<CurrentPath />} />
        <Route path="/app/hoje" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("routing guards", () => {
  beforeEach(() => {
    authState.mockReset();
    accessState.mockReset();
    authState.mockReturnValue({ user: { id: "u1" }, loading: false });
    accessState.mockReturnValue({ isSuperAdmin: true, loadingAccess: false });
  });

  it("aguarda autenticação e autorização antes de renderizar conteúdo", () => {
    authState.mockReturnValue({ user: null, loading: true });
    accessState.mockReturnValue({ isSuperAdmin: false, loadingAccess: true });

    renderGuard();

    expect(screen.getByText("Verificando permissões…")).toBeInTheDocument();
    expect(screen.queryByText("Área protegida")).not.toBeInTheDocument();
  });

  it("redireciona visitante para autenticação", async () => {
    authState.mockReturnValue({ user: null, loading: false });
    accessState.mockReturnValue({ isSuperAdmin: false, loadingAccess: false });

    renderGuard();

    expect(await screen.findByTestId("path")).toHaveTextContent("/auth");
  });

  it("redireciona usuário institucional para a aplicação", async () => {
    accessState.mockReturnValue({ isSuperAdmin: false, loadingAccess: false });

    renderGuard();

    expect(await screen.findByTestId("path")).toHaveTextContent("/app/hoje");
  });

  it("renderiza a área protegida para superadmin", () => {
    renderGuard();

    expect(screen.getByText("Área protegida")).toBeInTheDocument();
  });

  it("redireciona rota técnica legada conforme o papel", async () => {
    const renderLegacy = () => render(
      <MemoryRouter initialEntries={["/legacy"]}>
        <Routes>
          <Route path="/legacy" element={<LegacyTechRedirect superadminTo="/superadmin/canais" />} />
          <Route path="/superadmin/canais" element={<CurrentPath />} />
          <Route path="/app/hoje" element={<CurrentPath />} />
        </Routes>
      </MemoryRouter>,
    );

    renderLegacy();
    expect(await screen.findByTestId("path")).toHaveTextContent("/superadmin/canais");
  });
});
