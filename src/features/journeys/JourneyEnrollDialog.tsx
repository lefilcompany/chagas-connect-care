import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type PatientOption = { id: string; full_name: string; phone: string };

export function JourneyEnrollDialog({
  open, onOpenChange, onConfirm,
}: { open: boolean; onOpenChange: (v: boolean) => void; onConfirm: (ids: string[]) => Promise<void> }) {
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("patients")
      .select("id, full_name, phone")
      .order("full_name")
      .limit(200)
      .then(({ data }) => {
        setPatients((data ?? []) as PatientOption[]);
        setLoading(false);
      });
  }, [open]);

  const filtered = patients.filter(
    (p) => !q.trim() || p.full_name.toLowerCase().includes(q.toLowerCase()) || p.phone.includes(q),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Inscrever pessoas na jornada</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 overflow-hidden flex-1 flex flex-col">
          <Input placeholder="Buscar por nome ou telefone…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="flex-1 overflow-auto rounded-md border border-border">
            {loading ? (
              <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nenhum paciente encontrado.</p>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((p) => {
                  const checked = selected.has(p.id);
                  return (
                    <li key={p.id}>
                      <Label className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40 cursor-pointer">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setSelected((prev) => {
                              const n = new Set(prev);
                              if (v) n.add(p.id); else n.delete(p.id);
                              return n;
                            });
                          }}
                        />
                        <span className="flex-1">
                          <span className="block text-sm font-medium text-ink">{p.full_name}</span>
                          <span className="block text-xs text-muted-foreground">{p.phone || "sem telefone"}</span>
                        </span>
                      </Label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {selected.size} selecionada(s). Pacientes sem telefone ou já ativos serão ignorados automaticamente.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={selected.size === 0} onClick={() => onConfirm(Array.from(selected))}>
            Inscrever {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}