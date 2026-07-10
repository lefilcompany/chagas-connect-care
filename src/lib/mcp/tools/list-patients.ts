import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth } from "./_supabase";

export default defineTool({
  name: "list_patients",
  title: "Listar pessoas sob cuidado",
  description:
    "Lista pacientes visíveis para o usuário autenticado (respeitando RLS por " +
    "instituição). Aceita busca por nome/telefone e filtro por estágio.",
  inputSchema: {
    search: z.string().trim().min(1).max(120).optional().describe("Trecho do nome ou telefone."),
    stage: z.string().trim().min(1).max(60).optional().describe("Filtro exato de estágio."),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, stage, limit }, ctx) => {
    const guard = requireAuth(ctx);
    if (!guard.ok) return guard.response;
    const client = supabaseForUser(ctx);
    let q = client
      .from("patients")
      .select("id, full_name, phone, stage, channel_pref, institution, owner_id, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (stage) q = q.eq("stage", stage);
    if (search) q = q.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { patients: data ?? [] },
    };
  },
});