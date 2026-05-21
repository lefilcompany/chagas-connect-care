import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export default function Content() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const load = () => supabase.from("content_library").select("*").order("created_at", { ascending: false }).then(({ data }) => setItems(data ?? []));
  useEffect(() => { load(); }, []);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    const { error } = await supabase.from("content_library").insert(fd as any);
    if (error) return toast.error(error.message);
    toast.success("Conteúdo adicionado");
    setOpen(false); load();
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand">Conteúdos educativos</h1>
          <p className="text-muted-foreground mt-1">Biblioteca de orientações para pacientes, famílias e cuidadores.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button variant="hero"><Plus className="h-4 w-4" /> Novo conteúdo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Adicionar conteúdo</DialogTitle></DialogHeader>
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-2"><Label>Título</Label><Input name="title" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Categoria</Label>
                  <Select name="category" defaultValue="medicacao">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medicacao">Medicação</SelectItem>
                      <SelectItem value="alimentacao">Alimentação</SelectItem>
                      <SelectItem value="sono">Sono</SelectItem>
                      <SelectItem value="atividade">Atividade física</SelectItem>
                      <SelectItem value="familia">Família</SelectItem>
                      <SelectItem value="geral">Geral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Público</Label>
                  <Select name="audience" defaultValue="ambos">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paciente">Paciente</SelectItem>
                      <SelectItem value="familia">Família</SelectItem>
                      <SelectItem value="ambos">Ambos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>Conteúdo</Label><Textarea name="body" rows={5} required /></div>
              <Button type="submit" variant="hero" className="w-full">Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <article key={c.id} className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="text-xs uppercase font-semibold text-brand/70">{c.category} • {c.audience}</div>
            <h3 className="mt-2 font-display text-lg font-bold text-brand">{c.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}