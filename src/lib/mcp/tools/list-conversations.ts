import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth } from "./_supabase";

export default defineTool({
  name: "list_conversations",
  title: "Listar mensagens recentes",
  description:
    "Retorna as mensagens mais recentes visíveis para o usuário (respeita RLS). " +
    "Aceita filtro por direção (inbound/outbound).",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(25),
    direction: z.enum(["inbound", "outbound"]).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, direction }, ctx) => {
    const guard = requireAuth(ctx);
    if (!guard.ok) return guard.response;
    const client = supabaseForUser(ctx);
    let q = client
      .from("messages")
      .select("id, patient_id, direction, channel, status, body, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (direction) q = q.eq("direction", direction);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { messages: data ?? [] },
    };
  },
});