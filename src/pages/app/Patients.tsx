import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchers, qk } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { z } from "zod";

type Patient = {
  id: string; full_name: string; stage: string; phone: string;
  channel_pref: string; institution: string;
};

const schema = z.object({
  full_name: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(8).max(20),
  stage: z.enum(["diagnostico", "agudo", "cronico"]),
  channel_pref: z.enum(["whatsapp", "sms"]),
  institution: z.string().trim().max(160),
  notes: z.string().max(2000).optional(),
});

export default function Patients() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: items = [] } = useQuery({ queryKey: qk.patients, queryFn: fetchers.patients as () => Promise<Patient[]> });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [institution, setInstitution] = useState("");
  useEffect(() => {
    if (user) supabase.from("profiles").select("institution").eq("id", user.id).maybeSingle().then(({ data }) => setInstitution(data?.institution ?? ""));
  }, [user]);

  const onCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = schema.safeParse(fd);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const { error } = await supabase.from("patients").insert({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone,
      stage: parsed.data.stage,
      channel_pref: parsed.data.channel_pref,
      notes: parsed.data.notes ?? "",
      institution: parsed.data.institution || institution,
      owner_id: user!.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Paciente cadastrado");
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: qk.patients });
    queryClient.invalidateQueries({ queryKey: qk.dashboard });
  };

  const filtered = items.filter((p) => p.full_name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand">Pacientes</h1>
          <p className="text-muted-foreground mt-1">Pacientes, famílias e cuidadores acompanhados pela sua equipe.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="hero"><Plus className="h-4 w-4" /> Novo paciente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar paciente</DialogTitle></DialogHeader>
            <form onSubmit={onCreate} className="space-y-4">
              <div className="space-y-2"><Label>Nome completo</Label><Input name="full_name" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Telefone</Label><Input name="phone" placeholder="(81) 9..." required /></div>
                <div className="space-y-2"><Label>Etapa</Label>
                  <Select name="stage" defaultValue="diagnostico">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diagnostico">Diagnóstico</SelectItem>
                      <SelectItem value="agudo">Agudo</SelectItem>
                      <SelectItem value="cronico">Crônico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Canal preferido</Label>
                  <Select name="channel_pref" defaultValue="whatsapp">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Instituição</Label><Input name="institution" defaultValue={institution} /></div>
              </div>
              <div className="space-y-2"><Label>Observações</Label><Input name="notes" /></div>
              <Button type="submit" variant="hero" className="w-full">Cadastrar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar paciente..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Nenhum paciente cadastrado ainda.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-4">Nome</th><th className="p-4">Etapa</th><th className="p-4">Canal</th><th className="p-4">Telefone</th><th className="p-4">Instituição</th></tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-4"><Link to={`/app/pacientes/${p.id}`} className="font-medium text-brand hover:underline">{p.full_name}</Link></td>
                  <td className="p-4 capitalize">{p.stage}</td>
                  <td className="p-4 uppercase">{p.channel_pref}</td>
                  <td className="p-4">{p.phone}</td>
                  <td className="p-4">{p.institution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}