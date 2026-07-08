import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { journeyBuilderMock } = vi.hoisted(() => ({
  journeyBuilderMock: vi.fn(({ id }: { id: string }) => <div data-testid="journey-id">{id}</div>),
}));

vi.mock("@/features/journeys/JourneyBuilder", () => ({
  JourneyBuilder: journeyBuilderMock,
}));

import JourneyEditor from "@/pages/app/JourneyEditor";

describe("journey editor routing", () => {
  it("entrega o identificador da rota ao construtor de jornada", () => {
    render(
      <MemoryRouter initialEntries={["/app/jornadas/jornada-123"]}>
        <Routes>
          <Route path="/app/jornadas/:id" element={<JourneyEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("journey-id")).toHaveTextContent("jornada-123");
    expect(journeyBuilderMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "jornada-123" }),
      expect.anything(),
    );
  });
});
