import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { getSessionMock, onAuthStateChangeMock, signOutMock, unsubscribeMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  onAuthStateChangeMock: vi.fn(),
  signOutMock: vi.fn(),
  unsubscribeMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      onAuthStateChange: onAuthStateChangeMock,
      signOut: signOutMock,
    },
  },
}));

import { AuthProvider, useAuth } from "@/lib/auth";

function Probe() {
  const { user, loading, signOut } = useAuth();
  return (
    <div>
      <span>{loading ? "carregando" : user?.email ?? "anonimo"}</span>
      <button type="button" onClick={() => void signOut()}>sair</button>
    </div>
  );
}

describe("AuthProvider com Supabase real como contrato", () => {
  it("carrega a sessão retornada pelo cliente Supabase", async () => {
    const session = { user: { id: "u1", email: "admin@example.test" } };
    getSessionMock.mockResolvedValue({ data: { session } });
    onAuthStateChangeMock.mockReturnValue({
      data: { subscription: { unsubscribe: unsubscribeMock } },
    });

    render(<AuthProvider><Probe /></AuthProvider>);

    expect(screen.getByText("carregando")).toBeInTheDocument();
    expect(await screen.findByText("admin@example.test")).toBeInTheDocument();
  });

  it("faz logout pelo cliente Supabase", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    onAuthStateChangeMock.mockReturnValue({
      data: { subscription: { unsubscribe: unsubscribeMock } },
    });
    signOutMock.mockResolvedValue({ error: null });

    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("anonimo");
    screen.getByRole("button", { name: "sair" }).click();

    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
  });
});
