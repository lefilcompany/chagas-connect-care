import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { UsersRound, Search, ShieldCheck, Loader2 } from "lucide-react";

type AppRole = "admin" | "equipe" | "superadmin";
type Member = {
  id: string;
  full_name: string;
  role_label: string;
  professional_registry: string;
  institution: string;
  role: AppRole;
};

const roleLabels: Record<AppRole, string> = {
  superadmin: "Superadmin",
  admin: "Administrador",
  equipe: "Equipe",
};

async function fetchTeam(institution: string): Promise<Member[]> {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, role_label, professional_registry, institution")
    .eq("institution", institution)
    .order("full_name", { ascending: true });
  if (error) throw error;
  const ids = (profiles ?? []).map((p) => p.id);
  if (!ids.length) return [];
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", ids);
  const byUser = new Map<string, AppRole>();
  (roles ?? []).forEach((r) => {
    const current = byUser.get(r.user_id);
    // superadmin > admin > equipe
    const rank = (x: AppRole) => (x === "superadmin" ? 3 : x === "admin" ? 2 : 1);
    if (!current || rank(r.role as AppRole) > rank(current)) {
      byUser.set(r.user_id, r.role as AppRole);
    }
  });
  return (profiles ?? []).map((p) => ({
    ...p,
    role: byUser.get(p.id) ?? "equipe",
  }));
}

export default function Equipe() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: me } = useQuery({
    queryKey: ["me-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles").select("institution").eq("id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", {
        _user_id: user!.id, _role: "admin",
      });
      return !!data;
    },
    enabled: !!user,
  });

  const institution = me?.institution ?? "";

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team", institution],
    queryFn: () => fetchTeam(institution),
    enabled: !!institution,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      m.full_name.toLowerCase().includes(q) ||
      m.role_label.toLowerCase().includes(q) ||
      m.professional_registry.toLowerCase().includes(q)
    );
  }, [members, search]);

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const changeRole = async (memberId: string, next: AppRole) => {
    setUpdatingId(memberId);
    // Replace role: delete non-superadmin roles for this user then insert new one.
    const { error: delError } = await supabase
      .from("user_roles").delete().eq("user_id", memberId).neq("role", "superadmin");
    if (delError) {
      setUpdatingId(null);
      return toast.error(delError.message);
    }
    if (next !== "superadmin") {
      const { error: insError } = await supabase
        .from("user_roles").insert({ user_id: memberId, role: next });
      if (insError) {
        setUpdatingId(null);
        return toast.error(insError.message);
      }
    }
    await queryClient.invalidateQueries({ queryKey: ["team", institution] });
    setUpdatingId(null);
    toast.success("Papel atualizado");
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand">Equipe e permissões</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os membros da sua instituição e defina os papéis de acesso.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <UsersRound className="h-4 w-4" />
          {members.length} {members.length === 1 ? "membro" : "membros"}
        </div>
      </header>

      <div className="rounded-2xl border border-border bg-card shadow-card">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, função ou registro"
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-10 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando equipe…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            Nenhum membro encontrado.
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="w-full text-sm">
              <colgroup>
                <col style={{ width: "34%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "26%" }} />
              </colgroup>
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left py-2 px-4">Nome</th>
                  <th className="text-left py-2 px-4">Função</th>
                  <th className="text-left py-2 px-4">Registro</th>
                  <th className="text-left py-2 px-4">Papel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((m) => {
                  const isMe = m.id === user?.id;
                  const isSuper = m.role === "superadmin";
                  return (
                    <tr key={m.id} className="align-middle">
                      <td className="py-2 px-4">
                        <div className="font-semibold text-brand truncate">
                          {m.full_name || "Sem nome"}
                          {isMe && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}
                        </div>
                      </td>
                      <td className="py-2 px-4 text-muted-foreground truncate">
                        {m.role_label || "—"}
                      </td>
                      <td className="py-2 px-4 text-muted-foreground truncate">
                        {m.professional_registry || "—"}
                      </td>
                      <td className="py-2 px-4">
                        {isAdmin && !isSuper && !isMe ? (
                          <Select
                            value={m.role}
                            disabled={updatingId === m.id}
                            onValueChange={(v) => changeRole(m.id, v as AppRole)}
                          >
                            <SelectTrigger className="h-8 w-[160px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Administrador</SelectItem>
                              <SelectItem value="equipe">Equipe</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge
                            variant={m.role === "equipe" ? "secondary" : "default"}
                            className="capitalize"
                          >
                            {m.role === "admin" && <ShieldCheck className="h-3 w-3 mr-1" />}
                            {roleLabels[m.role]}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isAdmin && (
        <p className="text-xs text-muted-foreground">
          Apenas administradores podem alterar papéis. Você tem acesso somente de leitura.
        </p>
      )}
    </div>
  );
}
