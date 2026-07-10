import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth } from "./_supabase";

export default defineTool({
  name: "get_patient",
  title: "Detalhar paciente",
  description:
    "Retorna dados do paciente, rede de cuidado e últimas mensagens. Respeita RLS.",
  inputSchema: {
    patient_id: z.string().uuid().describe("UUID do paciente."),
    messages_limit: z.number().int().min(0).max(50).default(10),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ patient_id, messages_limit }, ctx) => {
    const guard = requireAuth(ctx);
    if (!guard.ok) return guard.response;
    const client = supabaseForUser(ctx);
    const [{ data: patient, error }, { data: network }, { data: messages }] = await Promise.all([
      client.from("patients").select("*").eq("id", patient_id).maybeSingle(),
      client
        .from("care_network_contacts")
        .select("id, relation, full_name, phone, receives_reminders, authorization_status")
        .eq("patient_id", patient_id),
      messages_limit > 0
        ? client
            .from("messages")
            .select("id, direction, channel, status, body, created_at")
            .eq("patient_id", patient_id)
            .order("created_at", { ascending: false })
            .limit(messages_limit)
        : Promise.resolve({ data: [] as unknown[] }),
    ]);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!patient)
      return {
        content: [{ type: "text", text: "Paciente não encontrado ou fora do seu escopo." }],
        isError: true,
      };
    const payload = { patient, care_network: network ?? [], recent_messages: messages ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});