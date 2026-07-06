import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
  apiArchiveJourney, apiCreateJourney, apiCurrentInstitution, apiDeleteJourney,
  apiDuplicateJourney, apiEnroll, apiGetJourney, apiJourneyRunCounts, apiListJourneys,
  apiPauseJourney, apiPublishJourney, apiUpdateJourney,
} from "./api";
import type { Journey, JourneyColumn, JourneyNode, JourneyNodeKind, JourneyTrigger } from "./types";

function uid() { return crypto.randomUUID(); }

export function useJourneys() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["journeys"], queryFn: apiListJourneys, staleTime: 30_000 });

  const create = useMutation({
    mutationFn: async (partial: { name: string; goal?: string }) => {
      const institution = await apiCurrentInstitution();
      const id = await apiCreateJourney({ name: partial.name, goal: partial.goal ?? "", institution });
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journeys"] }),
    onError: (e: any) => toast({ title: "Não foi possível criar", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDeleteJourney(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journeys"] }),
  });

  const duplicate = useMutation({
    mutationFn: (id: string) => apiDuplicateJourney(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journeys"] }),
  });

  const publish = useMutation({
    mutationFn: (id: string) => apiPublishJourney(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["journeys"] });
      qc.invalidateQueries({ queryKey: ["journey", id] });
      toast({ title: "Jornada publicada", description: "Novas inscrições serão executadas pelo motor." });
    },
    onError: (e: any) => toast({ title: "Falha ao publicar", description: e.message, variant: "destructive" }),
  });

  const pause = useMutation({
    mutationFn: (id: string) => apiPauseJourney(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["journeys"] });
      qc.invalidateQueries({ queryKey: ["journey", id] });
    },
  });

  const archive = useMutation({
    mutationFn: (id: string) => apiArchiveJourney(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journeys"] }),
  });

  return {
    journeys: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    create: (input: { name: string; goal?: string }) => create.mutateAsync(input),
    remove: (id: string) => remove.mutateAsync(id),
    duplicate: (id: string) => duplicate.mutateAsync(id),
    publish: (id: string) => publish.mutateAsync(id),
    pause: (id: string) => pause.mutateAsync(id),
    archive: (id: string) => archive.mutateAsync(id),
  };
}

export function useJourneyMetrics(journeyId: string | undefined) {
  return useQuery({
    queryKey: ["journey-metrics", journeyId],
    queryFn: () => apiJourneyRunCounts(journeyId!),
    enabled: !!journeyId,
    staleTime: 15_000,
  });
}

/**
 * Edita uma jornada individual com estado local (draft) + persistência explícita.
 * A UI mantém o mesmo formato: colunas + nós. O botão "Salvar rascunho" flusha
 * para o banco. Alterações de metadados (nome/status/audiência) são persistidas
 * imediatamente via `update` para não perder edições curtas.
 */
export function useJourney(id: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["journey", id],
    queryFn: () => apiGetJourney(id!),
    enabled: !!id,
  });

  const [draft, setDraft] = useState<Journey | null>(null);
  useEffect(() => {
    if (query.data) setDraft(query.data);
  }, [query.data?.id, query.data?.version]);

  const journey = draft ?? query.data ?? null;

  const persistMeta = useMutation({
    mutationFn: async (patch: Partial<Pick<Journey, "name" | "goal" | "status" | "audienceId" | "trigger">>) => {
      if (!journey) return;
      const dbPatch: any = {};
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.goal !== undefined) dbPatch.goal = patch.goal;
      if (patch.status !== undefined) dbPatch.status = patch.status;
      if (patch.audienceId !== undefined) dbPatch.audience_id = patch.audienceId;
      if (patch.trigger !== undefined) dbPatch.trigger = patch.trigger;
      await apiUpdateJourney(journey.id, dbPatch);
    },
    onSuccess: () => {
      if (id) qc.invalidateQueries({ queryKey: ["journey", id] });
      qc.invalidateQueries({ queryKey: ["journeys"] });
    },
  });

  const saveGraph = useMutation({
    mutationFn: async () => {
      if (!journey) return;
      await apiUpdateJourney(journey.id, { graph: { columns: journey.columns } });
    },
    onSuccess: () => {
      if (id) qc.invalidateQueries({ queryKey: ["journey", id] });
      toast({ title: "Rascunho salvo", description: "A estrutura da jornada foi persistida." });
    },
    onError: (e: any) => toast({ title: "Falha ao salvar", description: e.message, variant: "destructive" }),
  });

  const update = useCallback((_id: string, patch: Partial<Journey>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    // Persiste apenas metadados; graph fica no botão salvar.
    const meta: any = {};
    (["name", "goal", "status", "audienceId", "trigger"] as const).forEach((k) => {
      if (k in patch) meta[k] = (patch as any)[k];
    });
    if (Object.keys(meta).length > 0) persistMeta.mutate(meta);
  }, [persistMeta]);

  const mutateGraph = useCallback((fn: (cols: JourneyColumn[]) => JourneyColumn[]) => {
    setDraft((prev) => (prev ? { ...prev, columns: fn(prev.columns) } : prev));
  }, []);

  const addNode = useCallback((columnId: string, kind: JourneyNodeKind, title: string) => {
    mutateGraph((cols) => cols.map((c) =>
      c.id === columnId ? { ...c, nodes: [...c.nodes, { id: uid(), kind, title }] } : c,
    ));
  }, [mutateGraph]);

  const removeNode = useCallback((columnId: string, nodeId: string) => {
    mutateGraph((cols) => cols.map((c) =>
      c.id === columnId ? { ...c, nodes: c.nodes.filter((n) => n.id !== nodeId) } : c,
    ));
  }, [mutateGraph]);

  const patchNode = useCallback((columnId: string, nodeId: string, patch: Partial<JourneyNode>) => {
    mutateGraph((cols) => cols.map((c) =>
      c.id === columnId ? { ...c, nodes: c.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)) } : c,
    ));
  }, [mutateGraph]);

  const addColumn = useCallback((title: string) => {
    mutateGraph((cols) => [...cols, { id: uid(), title, nodes: [] }]);
  }, [mutateGraph]);

  const renameColumn = useCallback((columnId: string, title: string) => {
    mutateGraph((cols) => cols.map((c) => (c.id === columnId ? { ...c, title } : c)));
  }, [mutateGraph]);

  const removeColumn = useCallback((columnId: string) => {
    mutateGraph((cols) => cols.filter((c) => c.id !== columnId));
  }, [mutateGraph]);

  const enroll = useMutation({
    mutationFn: (patientIds: string[]) => apiEnroll(journey!.id, patientIds),
    onSuccess: (data) => {
      toast({
        title: `${data.inserted} pessoa(s) inscrita(s)`,
        description: `${data.skipped_dedupe} já ativa(s), ${data.skipped_no_phone} sem telefone.`,
      });
      qc.invalidateQueries({ queryKey: ["journey-runs", journey?.id] });
      qc.invalidateQueries({ queryKey: ["journey-metrics", journey?.id] });
    },
    onError: (e: any) => toast({ title: "Falha ao inscrever", description: e.message, variant: "destructive" }),
  });

  const dirty = useMemo(() => {
    if (!journey || !query.data) return false;
    return JSON.stringify(journey.columns) !== JSON.stringify(query.data.columns);
  }, [journey, query.data]);

  return {
    journey, isLoading: query.isLoading, dirty,
    addNode, removeNode, patchNode, addColumn, renameColumn, removeColumn, update,
    saveGraph: () => saveGraph.mutateAsync(),
    enroll: (ids: string[]) => enroll.mutateAsync(ids),
  };
}