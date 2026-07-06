import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ThreadMessage = {
  id: string;
  direction: string;
  body: string | null;
  sent_at: string | null;
  status: string | null;
  read_at: string | null;
  failed_at: string | null;
  last_error: string | null;
  template_name: string | null;
  media_asset_id: string | null;
  media_filename: string | null;
  media_mime_type: string | null;
};

export function useInboxThread(identityId: string | null, institution: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["inbox-thread", identityId],
    enabled: !!identityId,
    queryFn: async (): Promise<ThreadMessage[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, direction, body, sent_at, status, read_at, failed_at, last_error, template_name, media_asset_id, media_filename, media_mime_type")
        .eq("identity_id", identityId!)
        .order("sent_at", { ascending: true })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as ThreadMessage[];
    },
  });

  // Realtime: refresh thread on any new message for this identity
  useEffect(() => {
    if (!identityId) return;
    const channel = supabase
      .channel(`inbox-thread-${identityId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `identity_id=eq.${identityId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["inbox-thread", identityId] });
          qc.invalidateQueries({ queryKey: ["inbox-conversations", institution] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [identityId, institution, qc]);

  // Mark inbound as read when opening
  useEffect(() => {
    if (!identityId) return;
    supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("identity_id", identityId)
      .eq("direction", "inbound")
      .is("read_at", null)
      .then(() => {
        qc.invalidateQueries({ queryKey: ["inbox-conversations", institution] });
      });
  }, [identityId, institution, qc]);

  return query;
}