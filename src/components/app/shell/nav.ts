import {
  Sun, Users, Inbox, GitBranch, Target, BookOpen, BarChart3,
  FileText, Radio, Building2, ShieldCheck, UserCircle, UsersRound,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };

export const careNav: NavItem[] = [
  { to: "/app/hoje", label: "Hoje", icon: Sun, end: true },
  { to: "/app/pessoas", label: "Pessoas", icon: Users },
  { to: "/app/caixa", label: "Caixa de cuidado", icon: Inbox },
  { to: "/app/jornadas", label: "Jornadas", icon: GitBranch },
  { to: "/app/audiencias", label: "Audiências", icon: Target },
  { to: "/app/biblioteca", label: "Biblioteca", icon: BookOpen },
  { to: "/app/insights", label: "Insights", icon: BarChart3 },
];

export const adminNav: NavItem[] = [
  { to: "/app/admin/modelos-meta", label: "Modelos Meta", icon: FileText },
  { to: "/app/admin/canais", label: "Canais e integrações", icon: Radio },
  { to: "/app/admin/instituicao", label: "Instituição", icon: Building2 },
  { to: "/app/admin/equipe", label: "Equipe e permissões", icon: UsersRound },
  { to: "/app/admin/privacidade", label: "Privacidade e auditoria", icon: ShieldCheck },
  { to: "/app/admin/perfil", label: "Perfil", icon: UserCircle },
];