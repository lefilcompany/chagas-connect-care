import { useCallback, useEffect, useState } from "react";
import type { Journey, JourneyColumn, JourneyNode, JourneyNodeKind } from "./types";

const STORAGE_KEY = "ccc:journeys:v1";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function seed(): Journey[] {
  const now = new Date().toISOString();
  const j: Journey = {
    id: uid(),
    name: "Boas-vindas ao acompanhamento",
    goal: "Confirmar cadastro e apresentar o cuidado à pessoa recém-diagnosticada",
    status: "rascunho",
    audienceLabel: "Pessoas com consulta agendada nos próximos 7 dias",
    createdAt: now,
    updatedAt: now,
    metrics: { active: 0, completed: 0, interrupted: 0, failed: 0, responseRate: 0 },
    columns: [
      {
        id: uid(),
        title: "Entrada",
        nodes: [
          { id: uid(), kind: "entrada", title: "Cadastro concluído", description: "Quando o formulário público é finalizado" },
          { id: uid(), kind: "audiencia", title: "Consentimento ativo", description: "Filtra por pessoas com consentimento válido" },
        ],
      },
      {
        id: uid(),
        title: "Primeiro contato",
        nodes: [
          { id: uid(), kind: "whatsapp", title: "Modelo: boas_vindas_v2", description: "Enviar mensagem inicial" },
          { id: uid(), kind: "aguardar", title: "Aguardar 24h", description: "Tempo para resposta" },
          { id: uid(), kind: "verificar-resposta", title: "Respondeu?", description: "Ramifica com base em resposta recebida" },
        ],
      },
      {
        id: uid(),
        title: "Encaminhamento",
        nodes: [
          { id: uid(), kind: "criar-tarefa", title: "Retomar contato", description: "Gera tarefa para equipe" },
          { id: uid(), kind: "encerrar", title: "Encerrar fluxo", description: "Finaliza a jornada" },
        ],
      },
    ],
  };
  return [j];
}

function load(): Journey[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const s = seed();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      return s;
    }
    return JSON.parse(raw) as Journey[];
  } catch {
    return seed();
  }
}

function save(items: Journey[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useJourneys() {
  const [journeys, setJourneys] = useState<Journey[]>(() => load());

  useEffect(() => {
    save(journeys);
  }, [journeys]);

  const create = useCallback((partial: Partial<Journey>) => {
    const now = new Date().toISOString();
    const j: Journey = {
      id: uid(),
      name: partial.name ?? "Nova jornada",
      goal: partial.goal ?? "",
      status: "rascunho",
      columns: [
        { id: uid(), title: "Entrada", nodes: [{ id: uid(), kind: "entrada", title: "Definir gatilho" }] },
        { id: uid(), title: "Ações", nodes: [] },
        { id: uid(), title: "Encerramento", nodes: [{ id: uid(), kind: "encerrar", title: "Encerrar" }] },
      ],
      createdAt: now,
      updatedAt: now,
      metrics: { active: 0, completed: 0, interrupted: 0, failed: 0, responseRate: 0 },
      ...partial,
    };
    setJourneys((prev) => [j, ...prev]);
    return j;
  }, []);

  const update = useCallback((id: string, patch: Partial<Journey> | ((j: Journey) => Journey)) => {
    setJourneys((prev) =>
      prev.map((j) => {
        if (j.id !== id) return j;
        const next = typeof patch === "function" ? patch(j) : { ...j, ...patch };
        return { ...next, updatedAt: new Date().toISOString() };
      }),
    );
  }, []);

  const remove = useCallback((id: string) => {
    setJourneys((prev) => prev.filter((j) => j.id !== id));
  }, []);

  const duplicate = useCallback((id: string) => {
    setJourneys((prev) => {
      const src = prev.find((j) => j.id === id);
      if (!src) return prev;
      const now = new Date().toISOString();
      const copy: Journey = {
        ...src,
        id: uid(),
        name: `${src.name} (cópia)`,
        status: "rascunho",
        createdAt: now,
        updatedAt: now,
        columns: src.columns.map((c) => ({
          ...c,
          id: uid(),
          nodes: c.nodes.map((n) => ({ ...n, id: uid() })),
        })),
      };
      return [copy, ...prev];
    });
  }, []);

  return { journeys, create, update, remove, duplicate };
}

export function useJourney(id: string | undefined) {
  const { journeys, update } = useJourneys();
  const journey = journeys.find((j) => j.id === id);

  const addNode = useCallback((columnId: string, kind: JourneyNodeKind, title: string) => {
    if (!journey) return;
    update(journey.id, (j) => ({
      ...j,
      columns: j.columns.map((c) =>
        c.id === columnId
          ? { ...c, nodes: [...c.nodes, { id: uid(), kind, title }] }
          : c,
      ),
    }));
  }, [journey, update]);

  const removeNode = useCallback((columnId: string, nodeId: string) => {
    if (!journey) return;
    update(journey.id, (j) => ({
      ...j,
      columns: j.columns.map((c) =>
        c.id === columnId ? { ...c, nodes: c.nodes.filter((n) => n.id !== nodeId) } : c,
      ),
    }));
  }, [journey, update]);

  const patchNode = useCallback((columnId: string, nodeId: string, patch: Partial<JourneyNode>) => {
    if (!journey) return;
    update(journey.id, (j) => ({
      ...j,
      columns: j.columns.map((c) =>
        c.id === columnId
          ? { ...c, nodes: c.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)) }
          : c,
      ),
    }));
  }, [journey, update]);

  const addColumn = useCallback((title: string) => {
    if (!journey) return;
    update(journey.id, (j) => ({
      ...j,
      columns: [...j.columns, { id: uid(), title, nodes: [] } as JourneyColumn],
    }));
  }, [journey, update]);

  const renameColumn = useCallback((columnId: string, title: string) => {
    if (!journey) return;
    update(journey.id, (j) => ({
      ...j,
      columns: j.columns.map((c) => (c.id === columnId ? { ...c, title } : c)),
    }));
  }, [journey, update]);

  const removeColumn = useCallback((columnId: string) => {
    if (!journey) return;
    update(journey.id, (j) => ({
      ...j,
      columns: j.columns.filter((c) => c.id !== columnId),
    }));
  }, [journey, update]);

  return { journey, addNode, removeNode, patchNode, addColumn, renameColumn, removeColumn, update };
}