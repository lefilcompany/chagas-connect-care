import { createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { MessageTemplate } from "@/lib/templates";

/**
 * Public service used by the institutional templates catalog. Only the
 * behaviours the catalog needs are exposed — creation/submission live in
 * later phases so this interface stays small on purpose.
 */
export interface InstitutionTemplateService {
  list(institution: string): Promise<MessageTemplate[]>;
}

/** Real implementation: reads from the message_templates table scoped by RLS. */
export const supabaseInstitutionTemplates: InstitutionTemplateService = {
  async list(institution: string): Promise<MessageTemplate[]> {
    if (!institution) return [];
    const { data, error } = await supabase
      .from("message_templates")
      .select("*")
      .eq("institution", institution)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as MessageTemplate[];
  },
};

export const InstitutionTemplateServiceContext =
  createContext<InstitutionTemplateService>(supabaseInstitutionTemplates);

export const useInstitutionTemplateService = (): InstitutionTemplateService =>
  useContext(InstitutionTemplateServiceContext);

/**
 * Identity of the logged-in institutional user, as seen by the templates
 * catalog. Exposed via context so tests can drive the page without touching
 * the auth stack or React Query internals.
 */
export type InstitutionIdentity = {
  institution: string | null;
  isAdmin: boolean;
  loading: boolean;
  error: Error | null;
};

export const InstitutionIdentityContext =
  createContext<InstitutionIdentity | null>(null);

export const useInstitutionIdentity = (): InstitutionIdentity => {
  const ctx = useContext(InstitutionIdentityContext);
  if (!ctx) {
    throw new Error(
      "useInstitutionIdentity must be used inside <InstitutionIdentityProvider>",
    );
  }
  return ctx;
};