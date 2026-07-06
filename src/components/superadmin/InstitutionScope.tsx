import { createContext, useContext, useState, useMemo, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const ALL_INSTITUTIONS = "__ALL__";

type Ctx = {
  selected: string;
  setSelected: (v: string) => void;
  institutions: string[];
  isAll: boolean;
  loading: boolean;
};

const InstitutionScopeCtx = createContext<Ctx>({
  selected: ALL_INSTITUTIONS,
  setSelected: () => {},
  institutions: [],
  isAll: true,
  loading: false,
});

export function InstitutionScopeProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<string>(ALL_INSTITUTIONS);
  const { data, isLoading } = useQuery({
    queryKey: ["sa-institutions-list"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("institution")
        .not("institution", "is", null);
      const set = new Set<string>();
      for (const row of (data ?? []) as Array<{ institution: string | null }>) {
        const v = (row.institution ?? "").trim();
        if (v) set.add(v);
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
    },
  });

  const value = useMemo<Ctx>(
    () => ({
      selected,
      setSelected,
      institutions: data ?? [],
      isAll: selected === ALL_INSTITUTIONS,
      loading: isLoading,
    }),
    [selected, data, isLoading],
  );
  return <InstitutionScopeCtx.Provider value={value}>{children}</InstitutionScopeCtx.Provider>;
}

export function useInstitutionScope() {
  return useContext(InstitutionScopeCtx);
}