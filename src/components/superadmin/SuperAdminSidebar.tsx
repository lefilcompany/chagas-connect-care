import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Building2, Radio, MessageCircle, Settings2,
  FileText, Stethoscope, ShieldAlert, ArrowLeft, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

type Item = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; end?: boolean };

const overview: Item[] = [
  { to: "/superadmin/dashboard", label: "Visão geral", icon: LayoutDashboard, end: true },
  { to: "/superadmin/instituicoes", label: "Instituições", icon: Building2 },
  { to: "/superadmin/canais", label: "Canais", icon: Radio },
];

const whatsapp: Item[] = [
  { to: "/superadmin/whatsapp/configuracoes", label: "Configurações", icon: Settings2 },
  { to: "/superadmin/whatsapp/templates", label: "Templates e sync", icon: FileText },
  { to: "/superadmin/whatsapp/diagnostico", label: "Diagnóstico", icon: Stethoscope },
];

const audit: Item[] = [{ to: "/superadmin/auditoria", label: "Auditoria", icon: ShieldAlert }];

function Link({ item }: { item: Item }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-slate-200 hover:bg-white/5 hover:text-white",
        )
      }
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

function Section({ title, items }: { title: string; items: Item[] }) {
  return (
    <div className="mt-5">
      <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
        {title}
      </p>
      <ul className="space-y-0.5">
        {items.map((i) => (
          <li key={i.to}>
            <Link item={i} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SuperAdminSidebar() {
  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col overflow-hidden border-r border-white/5 bg-slate-950 text-slate-100">
      <div className="flex h-16 items-center gap-2 border-b border-white/5 px-4">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400">Super Admin</p>
          <p className="text-sm font-semibold text-white">Infraestrutura</p>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1" type="hover">
        <nav className="px-3 py-4">
          <Section title="Plataforma" items={overview} />
          <Section title="WhatsApp" items={whatsapp} />
          <Section title="Governança" items={audit} />
        </nav>
      </ScrollArea>
      <div className="border-t border-white/5 p-3">
        <NavLink
          to="/app/hoje"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para a aplicação
        </NavLink>
      </div>
    </aside>
  );
}