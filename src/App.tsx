import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AuthPage from "./pages/Auth.tsx";
import { AuthProvider } from "@/lib/auth";
import { AppLayout } from "@/components/app/AppLayout";
import Dashboard from "./pages/app/Dashboard";
import Patients from "./pages/app/Patients";
import PatientDetail from "./pages/app/PatientDetail";
import Messages from "./pages/app/Messages";
import Content from "./pages/app/Content";
import Reports from "./pages/app/Reports";
import Integrations from "./pages/app/Integrations";
import Profile from "./pages/app/Profile";

const queryClient = new QueryClient();

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
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="pacientes" element={<Patients />} />
              <Route path="pacientes/:id" element={<PatientDetail />} />
              <Route path="mensagens" element={<Messages />} />
              <Route path="conteudos" element={<Content />} />
              <Route path="relatorios" element={<Reports />} />
              <Route path="integracoes" element={<Integrations />} />
              <Route path="perfil" element={<Profile />} />
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
