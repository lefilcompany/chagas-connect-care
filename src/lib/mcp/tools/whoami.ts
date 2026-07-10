import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth } from "./_supabase";

export default defineTool({
  name: "whoami",
  title: "Quem sou eu",
  description:
    "Retorna o usuário autenticado (id, e-mail), papéis (superadmin/admin/equipe) " +
    "e a instituição associada. Útil para conferir o contexto antes de chamar " +
    "ferramentas que dependem de instituição.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const guard = requireAuth(ctx);
    if (!guard.ok) return guard.response;
    const client = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const [{ data: profile }, { data: roles }] = await Promise.all([
      client.from("profiles").select("id, full_name, role_label, institution").eq("id", userId).maybeSingle(),
      client.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const payload = {
      user_id: userId,
      email: ctx.getUserEmail(),
      profile: profile ?? null,
      roles: (roles ?? []).map((r: { role: string }) => r.role),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});