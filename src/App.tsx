import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AuthPage from "./pages/Auth.tsx";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import TermsOfUse from "./pages/legal/TermsOfUse";
import DataDeletion from "./pages/legal/DataDeletion";
import { AuthProvider } from "@/lib/auth";
import { AppLayout } from "@/components/app/AppLayout";
import { RequireSuperAdmin } from "@/components/auth/RequireSuperAdmin";
import { SuperAdminLayout } from "@/components/superadmin/SuperAdminLayout";
import Today from "./pages/app/Today";
import PatientDetail from "./pages/app/PatientDetail";
import People from "./pages/app/People";
import PersonDetail from "./pages/app/PersonDetail";
import Inbox from "./pages/app/Inbox";
import Journeys from "./pages/app/Journeys";
import JourneyEditor from "./pages/app/JourneyEditor";
import JourneyTasks from "./pages/app/JourneyTasks";
import Library from "./pages/app/Library";
import Audiences from "./pages/app/Audiences";
import SegmentEditor from "./pages/app/SegmentEditor";
import Insights from "./pages/app/Insights";
import Integrations from "./pages/app/Integrations";
import Profile from "./pages/app/Profile";
import Equipe from "./pages/app/Equipe";
import Instituicao from "./pages/app/Instituicao";
import Privacy from "./pages/app/Privacy";
import MessageTemplates from "./pages/app/MessageTemplates";
import MessageTemplateNew from "./pages/app/MessageTemplateNew";
import MessageTemplateEdit from "./pages/app/MessageTemplateEdit";
import OnboardingForm from "./pages/public/OnboardingForm";
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard";
import SuperAdminInstitutions from "./pages/superadmin/Institutions";
import SuperAdminChannels from "./pages/superadmin/Channels";
import SuperAdminWhatsAppSettings from "./pages/superadmin/WhatsAppSettings";
import SuperAdminWhatsAppTemplates from "./pages/superadmin/WhatsAppTemplates";
import SuperAdminWhatsAppDiagnostics from "./pages/superadmin/WhatsAppDiagnostics";
import SuperAdminAuditLog from "./pages/superadmin/AuditLog";
import { InstitutionIdentityProvider } from "@/services/institutionIdentityProvider";

function LegacyRedirect({ to }: { from: string; to: string }) {
  const params = useParams();
  const first = Object.values(params)[0];
  return <Navigate to={`/app/${to}${first ? `/${first}` : ""}`} replace />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/politica-de-privacidade" element={<PrivacyPolicy />} />
            <Route path="/termos-de-uso" element={<TermsOfUse />} />
            <Route path="/exclusao-de-dados" element={<DataDeletion />} />
            <Route path="/cadastro/:token" element={<OnboardingForm />} />

            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Navigate to="/app/hoje" replace />} />
              <Route path="hoje" element={<Today />} />
              <Route path="pessoas" element={<People />} />
              <Route path="pessoas/:id" element={<PersonDetail />} />
              <Route path="caixa" element={<Inbox />} />
              <Route path="jornadas" element={<Journeys />} />
              <Route path="jornadas/tarefas" element={<JourneyTasks />} />
              <Route path="jornadas/:id" element={<JourneyEditor />} />
              <Route path="biblioteca" element={<Library />} />
              <Route path="audiencias" element={<Audiences />} />
              <Route path="insights" element={<Insights />} />
              <Route path="admin/modelos-meta" element={<InstitutionIdentityProvider><MessageTemplates /></InstitutionIdentityProvider>} />
              <Route path="admin/modelos-meta/novo" element={<InstitutionIdentityProvider><MessageTemplateNew /></InstitutionIdentityProvider>} />
              <Route path="admin/modelos-meta/:templateId" element={<InstitutionIdentityProvider><MessageTemplateEdit /></InstitutionIdentityProvider>} />
              <Route path="admin/instituicao" element={<Instituicao />} />
              <Route path="admin/equipe" element={<Equipe />} />
              <Route path="admin/privacidade" element={<Privacy />} />
              <Route path="admin/perfil" element={<Profile />} />

              <Route path="admin/canais" element={<Navigate to="/superadmin/canais" replace />} />
              <Route path="configuracoes/whatsapp" element={<Navigate to="/superadmin/whatsapp/configuracoes" replace />} />

              <Route path="dashboard" element={<Navigate to="/app/hoje" replace />} />
              <Route path="pacientes" element={<Navigate to="/app/pessoas" replace />} />
              <Route path="pacientes/:id" element={<PatientDetail />} />
              <Route path="mensagens" element={<Navigate to="/app/caixa" replace />} />
              <Route path="conversas" element={<Navigate to="/app/caixa" replace />} />
              <Route path="conteudos" element={<Navigate to="/app/biblioteca" replace />} />
              <Route path="conteudos/campanha" element={<Navigate to="/app/jornadas" replace />} />
              <Route path="modelos" element={<Navigate to="/app/admin/modelos-meta" replace />} />
              <Route path="modelos/novo" element={<Navigate to="/app/admin/modelos-meta/novo" replace />} />
              <Route path="modelos/:templateId" element={<LegacyRedirect from="modelos" to="admin/modelos-meta" />} />
              <Route path="segmentos" element={<Navigate to="/app/audiencias" replace />} />
              <Route path="segmentos/novo" element={<SegmentEditor />} />
              <Route path="segmentos/:id/editar" element={<SegmentEditor />} />
              <Route path="segmentos/:id/duplicar" element={<SegmentEditor />} />
              <Route path="relatorios" element={<Navigate to="/app/insights" replace />} />
              <Route path="integracoes" element={<Integrations />} />
              <Route path="perfil" element={<Navigate to="/app/admin/perfil" replace />} />
            </Route>

            <Route element={<RequireSuperAdmin />}>
              <Route path="/superadmin" element={<SuperAdminLayout />}>
                <Route index element={<Navigate to="/superadmin/dashboard" replace />} />
                <Route path="dashboard" element={<SuperAdminDashboard />} />
                <Route path="instituicoes" element={<SuperAdminInstitutions />} />
                <Route path="canais" element={<SuperAdminChannels />} />
                <Route path="whatsapp" element={<Navigate to="/superadmin/whatsapp/configuracoes" replace />} />
                <Route path="whatsapp/configuracoes" element={<SuperAdminWhatsAppSettings />} />
                <Route path="whatsapp/templates" element={<SuperAdminWhatsAppTemplates />} />
                <Route path="whatsapp/diagnostico" element={<SuperAdminWhatsAppDiagnostics />} />
                <Route path="auditoria" element={<SuperAdminAuditLog />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
