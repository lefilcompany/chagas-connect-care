import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  UserCircle, ShieldCheck, Bell, Settings2, ChevronRight, Save,
  Mail, Phone, BadgeCheck, KeyRound, LogOut,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

type SectionId = "perfil" | "seguranca" | "preferencias" | "notificacoes" | "conta";

const sections: { id: SectionId; label: string; description: string; icon: typeof UserCircle }[] = [
  { id: "perfil", label: "Perfil", description: "Informações pessoais", icon: UserCircle },
  { id: "seguranca", label: "Segurança", description: "Senha e autenticação", icon: ShieldCheck },
  { id: "preferencias", label: "Preferências", description: "Aparência e idioma", icon: Settings2 },
  { id: "notificacoes", label: "Notificações", description: "Alertas e canais", icon: Bell },
  { id: "conta", label: "Conta", description: "Gerenciar conta", icon: KeyRound },
];

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState<SectionId>("perfil");
  const [profile, setProfile] = useState({ full_name: "", role_label: "", institution: "", professional_registry: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data: p }) => {
      if (p) setProfile({
        full_name: p.full_name ?? "",
        role_label: p.role_label ?? "",
        institution: p.institution ?? "",
        professional_registry: p.professional_registry ?? "",
      });
    });
  }, [user]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { institution: _i, ...editable } = profile;
    const { error } = await supabase.from("profiles").update(editable).eq("id", user!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
  };

  const initials = (profile.full_name || user?.email || "?")
    .split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold text-brand">Configurações</h1>
        <p className="text-muted-foreground mt-1">Gerencie seu perfil, segurança e preferências.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card text-center">
            <div className="mx-auto h-20 w-20 rounded-full bg-primary text-brand flex items-center justify-center text-2xl font-bold ring-4 ring-primary/30">
              {initials}
            </div>
            <div className="mt-3 font-semibold text-brand truncate">{profile.full_name || "Sem nome"}</div>
            <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
            {profile.institution && (
              <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-brand">
                <BadgeCheck className="h-3 w-3" /> {profile.institution}
              </div>
            )}
          </div>

          <nav className="rounded-2xl border border-border bg-card p-2 shadow-card">
            {sections.map((s) => {
              const isActive = active === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActive(s.id)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors relative",
                    isActive ? "bg-primary/40 text-brand" : "hover:bg-muted text-foreground/80",
                  )}
                >
                  {isActive && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-brand" />}
                  <s.icon className={cn("h-5 w-5", isActive ? "text-brand" : "text-muted-foreground")} />
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-sm font-semibold", isActive && "text-brand")}>{s.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.description}</div>
                  </div>
                  <ChevronRight className={cn("h-4 w-4", isActive ? "text-brand" : "text-muted-foreground/50")} />
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="rounded-2xl border border-border bg-card shadow-card">
          {active === "perfil" && (
            <SectionShell
              icon={UserCircle}
              title="Informações Pessoais"
              subtitle="Atualize seus dados profissionais"
              action={
                <Button form="profile-form" type="submit" variant="hero" disabled={saving}>
                  <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar alterações"}
                </Button>
              }
            >
              <form id="profile-form" onSubmit={saveProfile} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nome completo</Label>
                  <Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={user?.email ?? ""} disabled className="pl-9" />
                  </div>
                  <p className="text-xs text-brand flex items-center gap-1">
                    <BadgeCheck className="h-3 w-3" /> E-mail verificado · Não pode ser alterado
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Função</Label>
                    <Input
                      placeholder="Ex: Cardiologista"
                      value={profile.role_label}
                      onChange={(e) => setProfile({ ...profile, role_label: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">CRM/COREN</Label>
                    <Input
                      placeholder="Ex: CRM/SP 123456"
                      value={profile.professional_registry}
                      onChange={(e) => setProfile({ ...profile, professional_registry: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Instituição</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-0" />
                    <Input value={profile.institution} disabled />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A instituição é definida no cadastro e só pode ser alterada por um administrador.
                  </p>
                </div>
              </form>
            </SectionShell>
          )}

          {active === "seguranca" && <SecuritySection />}
          {active === "preferencias" && <PreferencesSection />}
          {active === "notificacoes" && <NotificationsSection />}
          {active === "conta" && (
            <AccountSection
              email={user?.email ?? ""}
              onLogout={async () => { await signOut(); navigate("/"); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Section shell ---------- */

function SectionShell({
  icon: Icon, title, subtitle, action, children,
}: {
  icon: typeof UserCircle;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-4 p-6 border-b border-border">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/60 flex items-center justify-center text-brand">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-brand">{title}</h2>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

/* ---------- Segurança ---------- */

function SecuritySection() {
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.next.length < 6) return toast.error("A nova senha deve ter ao menos 6 caracteres.");
    if (pwd.next !== pwd.confirm) return toast.error("As senhas não coincidem.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwd.next });
    setLoading(false);
    if (error) return toast.error(error.message);
    setPwd({ current: "", next: "", confirm: "" });
    toast.success("Senha atualizada com sucesso");
  };

  return (
    <SectionShell
      icon={ShieldCheck}
      title="Segurança"
      subtitle="Atualize sua senha e proteja sua conta"
      action={
        <Button form="security-form" type="submit" variant="hero" disabled={loading}>
          <Save className="h-4 w-4" /> {loading ? "Salvando..." : "Atualizar senha"}
        </Button>
      }
    >
      <form id="security-form" onSubmit={submit} className="space-y-5 max-w-lg">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Senha atual</Label>
          <Input type="password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} placeholder="••••••••" />
          <p className="text-xs text-muted-foreground">Por motivos de segurança, sua senha atual não é exibida.</p>
        </div>
        <Separator />
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nova senha</Label>
          <Input type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} placeholder="Mínimo 6 caracteres" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Confirmar nova senha</Label>
          <Input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} placeholder="Repita a nova senha" />
        </div>

        <div className="rounded-xl bg-muted/60 border border-border p-4 text-xs text-muted-foreground">
          <p className="font-semibold text-brand mb-1">Dicas de segurança</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Use ao menos 8 caracteres, com letras e números.</li>
            <li>Não compartilhe sua senha com outras pessoas.</li>
            <li>Evite usar a mesma senha em vários serviços.</li>
          </ul>
        </div>
      </form>
    </SectionShell>
  );
}

/* ---------- Preferências ---------- */

function PreferencesSection() {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light"
  );

  const toggleTheme = (v: boolean) => {
    const next = v ? "dark" : "light";
    setTheme(next);
    document.documentElement.classList.toggle("dark", v);
    try { localStorage.setItem("theme", next); } catch { /* ignore */ }
  };

  return (
    <SectionShell icon={Settings2} title="Preferências" subtitle="Personalize a aparência e o idioma">
      <div className="space-y-4 max-w-lg">
        <RowToggle
          title="Modo escuro"
          description="Reduz o brilho da interface em ambientes com pouca luz."
          checked={theme === "dark"}
          onCheckedChange={toggleTheme}
        />
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-brand">Idioma</div>
            <div className="text-sm text-muted-foreground">Português (Brasil)</div>
          </div>
          <span className="text-xs rounded-full bg-muted px-3 py-1 text-muted-foreground">Padrão</span>
        </div>
      </div>
    </SectionShell>
  );
}

/* ---------- Notificações ---------- */

function NotificationsSection() {
  const [prefs, setPrefs] = useState({ email: true, whatsapp: true, summary: false });
  return (
    <SectionShell icon={Bell} title="Notificações" subtitle="Escolha como deseja receber alertas">
      <div className="space-y-4 max-w-lg">
        <RowToggle
          title="Alertas por e-mail"
          description="Receba notificações importantes no seu e-mail."
          checked={prefs.email}
          onCheckedChange={(v) => setPrefs({ ...prefs, email: v })}
        />
        <Separator />
        <RowToggle
          title="Alertas no WhatsApp"
          description="Receba lembretes operacionais no WhatsApp."
          checked={prefs.whatsapp}
          onCheckedChange={(v) => setPrefs({ ...prefs, whatsapp: v })}
        />
        <Separator />
        <RowToggle
          title="Resumo semanal"
          description="Resumo das atividades da equipe toda segunda-feira."
          checked={prefs.summary}
          onCheckedChange={(v) => setPrefs({ ...prefs, summary: v })}
        />
      </div>
    </SectionShell>
  );
}

/* ---------- Conta ---------- */

function AccountSection({ email, onLogout }: { email: string; onLogout: () => void }) {
  return (
    <SectionShell icon={KeyRound} title="Conta" subtitle="Gerencie sua sessão e dados da conta">
      <div className="space-y-5 max-w-lg">
        <div className="rounded-xl border border-border p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">E-mail da conta</div>
          <div className="font-semibold text-brand mt-1">{email}</div>
        </div>

        <div className="rounded-xl border border-border p-4 flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-brand">Encerrar sessão</div>
            <div className="text-sm text-muted-foreground">Sair desta conta neste dispositivo.</div>
          </div>
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>

        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <div className="font-semibold text-destructive">Excluir conta</div>
          <p className="text-sm text-muted-foreground mt-1">
            A exclusão da conta deve ser solicitada ao administrador da sua instituição.
          </p>
        </div>
      </div>
    </SectionShell>
  );
}

/* ---------- helpers ---------- */

function RowToggle({
  title, description, checked, onCheckedChange,
}: { title: string; description: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="font-semibold text-brand">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}