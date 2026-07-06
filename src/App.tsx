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
import Today from "./pages/app/Today";
import Patients from "./pages/app/Patients";
import PatientDetail from "./pages/app/PatientDetail";
import People from "./pages/app/People";
import PersonDetail from "./pages/app/PersonDetail";
import Inbox from "./pages/app/Inbox";
import Journeys from "./pages/app/Journeys";
import JourneyEditor from "./pages/app/JourneyEditor";
import JourneyTasks from "./pages/app/JourneyTasks";
import Messages from "./pages/app/Messages";
import Content from "./pages/app/Content";
import Campaign from "./pages/app/Campaign";
import Library from "./pages/app/Library";
import Audiences from "./pages/app/Audiences";
import SegmentEditor from "./pages/app/SegmentEditor";
import Reports from "./pages/app/Reports";
import Insights from "./pages/app/Insights";
import Channels from "./pages/app/Channels";
import Integrations from "./pages/app/Integrations";
import Profile from "./pages/app/Profile";
import Equipe from "./pages/app/Equipe";
import Instituicao from "./pages/app/Instituicao";
import Privacy from "./pages/app/Privacy";
import WhatsAppSettings from "./pages/app/WhatsAppSettings";
import MessageTemplates from "./pages/app/MessageTemplates";
import MessageTemplateNew from "./pages/app/MessageTemplateNew";
import MessageTemplateEdit from "./pages/app/MessageTemplateEdit";
import OnboardingForm from "./pages/public/OnboardingForm";
import { InstitutionIdentityProvider } from "@/services/institutionIdentityProvider";

function LegacyRedirect({ to }: { from: string; to: string }) {
  const params = useParams();
  const first = Object.values(params)[0];
  return <Navigate to={`/app/${to}${first ? `/${first}` : ""}`} replace />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Aggressive caching: dados ficam "frescos" por 5 min e em memória por 30 min,
      // assim a troca de rotas não dispara loaders/refetch o tempo todo.
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
              {/* New IA */}
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
              <Route
                path="admin/modelos-meta"
                element={<InstitutionIdentityProvider><MessageTemplates /></InstitutionIdentityProvider>}
              />
              <Route
                path="admin/modelos-meta/novo"
                element={<InstitutionIdentityProvider><MessageTemplateNew /></InstitutionIdentityProvider>}
              />
              <Route
                path="admin/modelos-meta/:templateId"
                element={<InstitutionIdentityProvider><MessageTemplateEdit /></InstitutionIdentityProvider>}
              />
              <Route path="admin/canais" element={<Channels />} />
              <Route path="configuracoes/whatsapp" element={<WhatsAppSettings />} />
              <Route path="admin/instituicao" element={<Instituicao />} />
              <Route path="admin/equipe" element={<Equipe />} />
              <Route path="admin/privacidade" element={<Privacy />} />
              <Route path="admin/perfil" element={<Profile />} />

              {/* Legacy routes preserved via redirects (no broken bookmarks) */}
              <Route path="dashboard" element={<Navigate to="/app/hoje" replace />} />
              <Route path="pacientes" element={<Navigate to="/app/pessoas" replace />} />
              {/* Ficha clínica completa (fluxo pré-existente, ainda usado como visão detalhada de edição) */}
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
