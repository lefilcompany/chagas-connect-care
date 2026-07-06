import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type InboxConversation = {
  identity_id: string;
  institution: string;
  patient_id: string | null;
  contact_id: string | null;
  service_window_expires_at: string | null;
  last_message_at: string | null;
  display_name: string;
  is_known: boolean;
  unread: number;
  last_body: string;
  last_direction: "inbound" | "outbound" | null;
  phone: string;
  channel: "whatsapp";
};

export function useInstitution() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-institution", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("institution").eq("id", user!.id).maybeSingle();
      return (data as any)?.institution ?? "";
    },
  });
}

export function useInboxConversations(institution: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["inbox-conversations", institution],
    enabled: !!institution,
    queryFn: async (): Promise<InboxConversation[]> => {
      const { data: convs } = await supabase
        .from("whatsapp_conversations")
        .select("identity_id, institution, patient_id, contact_id, service_window_expires_at, last_message_at")
        .eq("institution", institution)
        .order("last_message_at", { ascending: false })
        .limit(200);
      const list = (convs ?? []) as any[];
      if (!list.length) return [];

      const identityIds = list.map((c) => c.identity_id);
      const { data: idents } = await supabase
        .from("whatsapp_identities")
        .select("id, display_name, phone_e164")
        .in("id", identityIds);
      const identMap = new Map((idents ?? []).map((i: any) => [i.id, i]));

      const { data: lastMsgs } = await supabase
        .from("messages")
        .select("identity_id, body, sent_at, direction, read_at")
        .in("identity_id", identityIds)
        .order("sent_at", { ascending: false })
        .limit(1000);

      const lastByIdent = new Map<string, any>();
      const unreadByIdent = new Map<string, number>();
      for (const m of (lastMsgs ?? []) as any[]) {
        if (!lastByIdent.has(m.identity_id)) lastByIdent.set(m.identity_id, m);
        if (m.direction === "inbound" && !m.read_at) {
          unreadByIdent.set(m.identity_id, (unreadByIdent.get(m.identity_id) ?? 0) + 1);
        }
      }

      const patientIds = list.map((c) => c.patient_id).filter(Boolean) as string[];
      const contactIds = list.map((c) => c.contact_id).filter(Boolean) as string[];
      const [pats, cons] = await Promise.all([
        patientIds.length
          ? supabase.from("patients").select("id, full_name").in("id", patientIds)
          : Promise.resolve({ data: [] as any[] }),
        contactIds.length
          ? supabase.from("contacts").select("id, full_name").in("id", contactIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const patMap = new Map((pats.data ?? []).map((p: any) => [p.id, p.full_name]));
      const conMap = new Map((cons.data ?? []).map((c: any) => [c.id, c.full_name]));

      return list.map<InboxConversation>((c) => {
        const ident = identMap.get(c.identity_id) as any;
        const isKnown = !!(c.patient_id || c.contact_id);
        const last = lastByIdent.get(c.identity_id);
        return {
          identity_id: c.identity_id,
          institution: c.institution,
          patient_id: c.patient_id,
          contact_id: c.contact_id,
          service_window_expires_at: c.service_window_expires_at,
          last_message_at: c.last_message_at ?? last?.sent_at ?? null,
          display_name:
            conMap.get(c.contact_id) ||
            patMap.get(c.patient_id) ||
            ident?.display_name ||
            ident?.phone_e164 ||
            "Contato desconhecido",
          is_known: isKnown,
          unread: unreadByIdent.get(c.identity_id) ?? 0,
          last_body: last?.body ?? "",
          last_direction: (last?.direction as "inbound" | "outbound") ?? null,
          phone: ident?.phone_e164 ?? "",
          channel: "whatsapp",
        };
      });
    },
  });

  useEffect(() => {
    if (!institution) return;
    const channel = supabase
      .channel(`inbox-list-${institution}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["inbox-conversations", institution] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations" }, () => {
        qc.invalidateQueries({ queryKey: ["inbox-conversations", institution] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [institution, qc]);

  return query;
}