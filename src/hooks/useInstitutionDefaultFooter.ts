import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Reads the institution-level default template footer, respecting the
 * `use_as_template_footer_default` toggle. Returns an empty string when the
 * institution has no default configured or when the toggle is off — in that
 * case the per-template "use institutional default" option is not offered.
 */
export function useInstitutionDefaultFooter(institution: string | null | undefined) {
  const query = useQuery({
    queryKey: ["institution-default-footer", institution ?? ""],
    enabled: !!institution,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institution_whatsapp_settings")
        .select("default_template_footer_text, use_as_template_footer_default")
        .eq("institution", institution!)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
  const enabled = !!query.data?.use_as_template_footer_default;
  const text = (query.data?.default_template_footer_text ?? "").trim();
  return {
    /** Institution default footer text, or "" when unavailable/disabled. */
    defaultFooter: enabled ? text : "",
    /** True when the institution has an active default footer to offer. */
    hasDefault: enabled && text.length > 0,
    loading: query.isLoading,
  };
}