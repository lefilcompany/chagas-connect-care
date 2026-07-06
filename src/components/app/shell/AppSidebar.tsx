import { NavLink } from "react-router-dom";
import { useState } from "react";
import { ChevronDown, ChevronsLeft, ChevronsRight, HeartPulse, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { adminNav, careNav, type NavItem } from "./nav";
import { ChannelHealthPill } from "./ChannelHealthPill";
import elo2Logo from "@/assets/elo2-logo.png.asset.json";

type Props = {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
  profileName?: string;
  email?: string;
  onSignOut?: () => void;
};

function NavItemLink({ item, collapsed, onClick }: { item: NavItem; collapsed: boolean; onClick?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) => cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors tap-target",
        isActive
          ? "bg-mint-soft text-care"
          : "text-foreground/75 hover:bg-secondary hover:text-foreground",
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" aria-hidden />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  );
}

export function AppSidebar({ collapsed, onToggleCollapse, onCloseMobile, profileName, email, onSignOut }: Props) {
  const [adminOpen, setAdminOpen] = useState(false);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-sidebar transition-[width] duration-200",
        collapsed ? "w-20" : "w-[264px]",
      )}
      aria-label="Navegação principal"
    >
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <NavLink to="/app/hoje" className="flex items-center gap-2" aria-label="Chagas Connect Care — Início">
          <img src={elo2Logo.url} alt="" aria-hidden className="h-8 w-auto" />
        </NavLink>
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden tap-target rounded-lg text-muted-foreground hover:text-foreground"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="mx-3 mt-4 rounded-xl bg-mint-soft/70 p-3">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-care">
            <HeartPulse className="h-3 w-3" aria-hidden /> Centro de cuidado
          </div>
          <p className="mt-1 text-xs font-medium text-ink">Comunicação clínica coordenada</p>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {!collapsed && (
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Cuidado
          </p>
        )}
        <ul className="space-y-0.5">
          {careNav.map((n) => (
            <li key={n.to}>
              <NavItemLink item={n} collapsed={collapsed} onClick={onCloseMobile} />
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <button
            onClick={() => setAdminOpen((v) => !v)}
            aria-expanded={adminOpen}
            aria-controls="admin-nav"
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground",
              collapsed && "justify-center",
            )}
          >
            {!collapsed && <span>Administração</span>}
            <ChevronDown
              aria-hidden
              className={cn("h-3.5 w-3.5 transition-transform", adminOpen && "rotate-180")}
            />
          </button>
          {adminOpen && (
            <ul id="admin-nav" className="mt-1 space-y-0.5">
              {adminNav.map((n) => (
                <li key={n.to}>
                  <NavItemLink item={n} collapsed={collapsed} onClick={onCloseMobile} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </nav>

      <div className="border-t border-border p-3">
        <div className={cn("mb-3", collapsed && "flex justify-center")}>
          <ChannelHealthPill collapsed={collapsed} />
        </div>
        {!collapsed && (
          <div className="mb-2 px-1 text-xs">
            <div className="truncate font-semibold text-ink">{profileName || "—"}</div>
            <div className="truncate text-muted-foreground">{email}</div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            className="hidden lg:inline-flex tap-target items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
          {!collapsed && onSignOut && (
            <button
              onClick={onSignOut}
              className="tap-target flex-1 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              Sair
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}