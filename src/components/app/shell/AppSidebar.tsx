import { NavLink } from "react-router-dom";
import { useState } from "react";
import { ChevronDown, ChevronsLeft, ChevronsRight, HeartPulse, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { adminNav, careNav, type NavItem } from "./nav";
import { ChannelHealthPill } from "./ChannelHealthPill";
import elo2Logo from "@/assets/elo2-logo.png.asset.json";
import elo2Icon from "@/assets/icone_eloz.png.asset.json";

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
        "group flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 tap-target",
        collapsed
          ? "h-11 w-11 shrink-0 flex-col justify-center self-center rounded-2xl px-0 py-0"
          : "px-3 py-2.5",
        isActive
          ? "bg-mint-soft text-care"
          : "text-foreground/80 hover:bg-accent/60 hover:shadow-sm hover:text-foreground",
      )}
    >
      <item.icon className={cn("shrink-0", collapsed ? "h-[18px] w-[18px]" : "h-4 w-4")} aria-hidden />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  );
}

export function AppSidebar({ collapsed, onToggleCollapse, onCloseMobile, profileName, email, onSignOut }: Props) {
  const [adminOpen, setAdminOpen] = useState(false);

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden border-r border-border bg-sidebar transition-[width] duration-200",
        collapsed ? "w-20" : "w-[264px]",
      )}
      aria-label="Navegação principal"
    >
      <div className={cn(
        "flex h-16 shrink-0 items-center border-b border-border",
        collapsed ? "justify-center px-2" : "justify-between px-4",
      )}>
        <NavLink to="/app/hoje" className="flex items-center gap-2" aria-label="Chagas Connect Care — Início">
          <img
            src={collapsed ? elo2Icon.url : elo2Logo.url}
            alt=""
            aria-hidden
            className={cn(collapsed ? "h-8 w-8" : "h-8 w-auto")}
          />
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
        <div className="mx-3 mt-4 shrink-0 rounded-xl bg-mint-soft/70 p-3">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-care">
            <HeartPulse className="h-3 w-3" aria-hidden /> Centro de cuidado
          </div>
          <p className="mt-1 text-xs font-medium text-ink">Comunicação clínica coordenada</p>
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1" type="hover" scrollHideDelay={400}>
        <nav className={cn("py-4", collapsed ? "flex flex-col items-center px-1" : "px-3")}>
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
              "flex items-center rounded-xl text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition-all duration-200 hover:bg-accent/60 hover:shadow-sm hover:text-foreground",
              collapsed
                ? "h-11 w-11 shrink-0 justify-center self-center rounded-2xl p-0"
                : "w-full justify-between px-3 py-2",
            )}
          >
            {!collapsed && <span>Administração</span>}
            <ChevronDown
              aria-hidden
              className={cn("shrink-0", collapsed ? "h-[18px] w-[18px]" : "h-3.5 w-3.5 transition-transform", adminOpen && !collapsed && "rotate-180")}
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
      </ScrollArea>

      <div className="shrink-0 border-t border-border p-3">
        <div className={cn("mb-3", collapsed && "flex justify-center")}>
          <ChannelHealthPill collapsed={collapsed} />
        </div>
        {!collapsed && (
          <div className="mb-2 px-1 text-xs">
            <div className="truncate font-semibold text-ink">{profileName || "—"}</div>
            <div className="truncate text-muted-foreground">{email}</div>
          </div>
        )}
        <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
          <button
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            className="hidden lg:inline-flex tap-target h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
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
