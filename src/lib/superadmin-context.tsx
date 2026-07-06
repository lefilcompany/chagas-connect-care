import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccessControl } from "@/lib/access";

const STORAGE_KEY = "chagas-connect-care:superadmin-institution";

type SuperAdminScopeContextValue = {
  institutions: string[];
  selectedInstitution: string | null;
  setSelectedInstitution: (institution: string | null) => void;
  loadingInstitutions: boolean;
};

const SuperAdminScopeContext = createContext<SuperAdminScopeContextValue | null>(null);

export function SuperAdminScopeProvider({ children }: { children: ReactNode }) {
  const { isSuperAdmin } = useAccessControl();
  const [selectedInstitution, setSelectedInstitutionState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    return stored && stored !== "all" ? stored : null;
  });

  const institutionsQuery = useQuery({
    queryKey: ["superadmin-institutions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("institution")
        .neq("institution", "")
        .order("institution", { ascending: true });
      if (error) throw error;
      return Array.from(
        new Set((data ?? []).map((row) => row.institution?.trim()).filter(Boolean) as string[]),
      );
    },
    enabled: isSuperAdmin,
    staleTime: 5 * 60_000,
  });

  const institutions = institutionsQuery.data ?? [];

  useEffect(() => {
    if (selectedInstitution && institutions.length > 0 && !institutions.includes(selectedInstitution)) {
      setSelectedInstitutionState(null);
      window.sessionStorage.setItem(STORAGE_KEY, "all");
    }
  }, [institutions, selectedInstitution]);

  const setSelectedInstitution = (institution: string | null) => {
    setSelectedInstitutionState(institution);
    window.sessionStorage.setItem(STORAGE_KEY, institution ?? "all");
  };

  const value = useMemo(
    () => ({
      institutions,
      selectedInstitution,
      setSelectedInstitution,
      loadingInstitutions: institutionsQuery.isLoading,
    }),
    [institutions, institutionsQuery.isLoading, selectedInstitution],
  );

  return (
    <SuperAdminScopeContext.Provider value={value}>
      {children}
    </SuperAdminScopeContext.Provider>
  );
}

export function useSuperAdminScope() {
  const context = useContext(SuperAdminScopeContext);
  if (!context) {
    throw new Error("useSuperAdminScope must be used inside SuperAdminScopeProvider");
  }
  return context;
}
