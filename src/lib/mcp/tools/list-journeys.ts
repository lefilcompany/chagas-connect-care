import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth } from "./_supabase";

export default defineTool({
  name: "list_journeys",
  title: "Listar jornadas",
  description:
    "Lista jornadas visíveis para o usuário (respeita RLS por instituição). " +
    "Aceita filtro por status.",
  inputSchema: {
    status: z.enum(["draft", "active", "paused", "archived"]).optional(),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    const guard = requireAuth(ctx);
    if (!guard.ok) return guard.response;
    const client = supabaseForUser(ctx);
    let q = client
      .from("journeys")
      .select("id, name, description, status, institution, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { journeys: data ?? [] },
    };
  },
});