import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import elo2Logo from "@/assets/elo2-logo.png.asset.json";

const signupSchema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome").max(120),
  role_label: z.string().trim().min(2, "Informe sua função").max(80),
  professional_registry: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(8, "Mínimo 8 caracteres").max(72),
});

const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

export default function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("login");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate("/app");
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: {
          full_name: parsed.data.full_name,
          role_label: parsed.data.role_label,
          professional_registry: parsed.data.professional_registry ?? "",
        },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Você já está logado.");
    navigate("/app");
  };


  return (
    <main className="min-h-dvh bg-gradient-soft flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <h1 className="sr-only">Acessar Chagas Cuidado Digital</h1>
        <Link to="/" className="mb-8 flex items-center justify-center" aria-label="ELO2 — Início">
          <img src={elo2Logo.url} alt="ELO2" className="h-12 w-auto" />
        </Link>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2"><Label htmlFor="li-email">E-mail</Label><Input id="li-email" name="email" type="email" placeholder="seu@email.com" required /></div>
                <div className="space-y-2"><Label htmlFor="li-pass">Senha</Label><Input id="li-pass" name="password" type="password" placeholder="Digite sua senha" required /></div>
                <Button type="submit" variant="hero" className="w-full" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2"><Label htmlFor="full_name">Nome completo</Label><Input id="full_name" name="full_name" placeholder="Seu nome completo" required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label htmlFor="role_label">Função</Label><Input id="role_label" name="role_label" placeholder="Médico, Enfermeiro..." required /></div>
                <div className="space-y-2"><Label htmlFor="professional_registry">CRM/COREN</Label><Input id="professional_registry" name="professional_registry" placeholder="Opcional" /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="su-email">E-mail</Label><Input id="su-email" name="email" type="email" placeholder="seu@email.com" required /></div>
                <div className="space-y-2"><Label htmlFor="su-pass">Senha</Label><Input id="su-pass" name="password" type="password" placeholder="Mínimo 8 caracteres" minLength={8} required /></div>
                <Button type="submit" variant="hero" className="w-full" disabled={loading}>{loading ? "Criando..." : "Criar conta"}</Button>
              </form>
            </TabsContent>

          </Tabs>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/" className="hover:text-brand">← Voltar ao site</Link>
        </p>
      </div>
    </main>
  );
}