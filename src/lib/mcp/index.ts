import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listPatientsTool from "./tools/list-patients";
import getPatientTool from "./tools/get-patient";
import listJourneysTool from "./tools/list-journeys";
import listConversationsTool from "./tools/list-conversations";

// The OAuth issuer MUST point at the direct Supabase host derived from the
// project ref (the .lovable.cloud proxy publishes a different issuer in its
// discovery document, and mcp-js rejects mismatches). VITE_SUPABASE_PROJECT_ID
// is inlined by Vite at build time, so this remains import-safe.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "chagas-digital-care-mcp",
  title: "Chagas Digital Care",
  version: "0.1.0",
  instructions:
    "Ferramentas do Chagas Digital Care. O chamador atua como o próprio usuário " +
    "autenticado — todas as políticas de RLS (papel, instituição, propriedade) são " +
    "aplicadas. Use `whoami` para inspecionar o contexto do usuário conectado, " +
    "`list_patients`/`get_patient` para consultar pessoas sob cuidado, " +
    "`list_journeys` para jornadas ativas e `list_conversations` para a caixa de " +
    "conversas de WhatsApp.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoamiTool,
    listPatientsTool,
    getPatientTool,
    listJourneysTool,
    listConversationsTool,
  ],
});