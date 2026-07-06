import { Radio } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Compact channel health indicator for sidebar footer.
 * Reads from institution_whatsapp_settings; when unavailable shows neutral state.
 * Uses icon + label so status is never conveyed by color alone.
 */
export function ChannelHealthPill({ collapsed = false }: { collapsed?: boolean }) {
  const { data } = useQuery({
    queryKey: ["channel-health-pill"],
    queryFn: async () => {
      const { data } = await supabase
        .from("institution_whatsapp_settings")
        .select("phone_verified, business_verification_status")
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 60_000,
  });

  const ok = data?.phone_verified === true;
  const label = ok ? "Canais operando" : data ? "Verificar canais" : "Sem canal";

  return (
    <div
      role="status"
      aria-label={`Status dos canais: ${label}`}
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
        ok ? "border-care/30 bg-mint-soft text-care" : "border-border bg-background text-muted-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block h-2 w-2 rounded-full",
          ok ? "bg-care" : "bg-muted-foreground/50",
        )}
      />
      {!collapsed && (
        <span className="flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5" aria-hidden />
          {label}
        </span>
      )}
    </div>
  );
}