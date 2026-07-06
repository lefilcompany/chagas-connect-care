import { NavLink } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  Building2,
  FileClock,
  LayoutDashboard,
  LogOut,
  MessageCircleMore,
  Radio,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSuperAdminScope } from "@/lib/superadmin-context";

const navItems = [
  { to: "/superadmin/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { to: "/superadmin/instituicoes", label: "Instituições", icon: Building2 },
  { to: "/superadmin/canais", label: "Canais", icon: Radio },
  { to: "/superadmin/whatsapp/configuracoes", label: "Configurações WhatsApp", icon: Settings2 },
  { to: "/superadmin/whatsapp/templates", label: "Templates e sincronização", icon: MessageCircleMore },
  { to: "/superadmin/whatsapp/diagnostico", label: "Diagnóstico", icon: Activity },
  { to: "/superadmin/auditoria", label: "Auditoria", icon: FileClock },
];

type Props = {
  email?: string;
  fullName?: string;
  onSignOut: () => void;
  onCloseMobile?: () => void;
};

export function SuperAdminSidebar({ email, fullName, onSignOut, onCloseMobile }: Props) {
  const {
    institutions,
    selectedInstitution,
    setSelectedInstitution,
    loadingInstitutions,
  } = useSuperAdminScope();

  return (
    <aside className="flex h-full w-[292px] flex-col border-r border-border bg-ink text-white" aria-label="Navegação do Super Admin">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-5">
        <NavLink to="/superadmin/dashboard" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-care text-white">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-bold">Super Admin</p>
            <p className="text-[11px] text-white/60">Infraestrutura global</p>
          </div>
        </NavLink>
        {onCloseMobile && (
          <button onClick={onCloseMobile} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="shrink-0 border-b border-white/10 p-4">
        <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
          Instituição administrada
        </label>
        <Select
          value={selectedInstitution ?? "__all__"}
          onValueChange={(value) => setSelectedInstitution(value === "__all__" ? null : value)}
          disabled={loadingInstitutions}
        >
          <SelectTrigger className="border-white/15 bg-white/10 text-white focus:ring-care">
            <SelectValue placeholder="Selecionar instituição" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as instituições</SelectItem>
            {institutions.map((institution) => (
              <SelectItem key={institution} value={institution}>{institution}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-2 text-[11px] leading-relaxed text-white/50">
          Ações técnicas exigem uma instituição específica selecionada.
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1" type="hover" scrollHideDelay={400}>
        <nav className="space-y-1 p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onCloseMobile}
              className={({ isActive }) => cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-care text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </ScrollArea>

      <div className="shrink-0 border-t border-white/10 p-4">
        <div className="mb-3 min-w-0">
          <p className="truncate text-sm font-semibold">{fullName || "Super Admin"}</p>
          <p className="truncate text-xs text-white/55">{email}</p>
        </div>
        <div className="grid gap-2">
          <NavLink to="/app/hoje" className="flex items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/75 hover:bg-white/10 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Voltar para a aplicação
          </NavLink>
          <button onClick={onSignOut} className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </div>
    </aside>
  );
}
