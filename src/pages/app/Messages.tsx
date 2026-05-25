import { useQuery } from "@tanstack/react-query";
import { fetchers, qk } from "@/lib/queries";
import { Link } from "react-router-dom";

export default function Messages() {
  const { data: msgs = [] } = useQuery({ queryKey: qk.messages, queryFn: fetchers.messages });
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold text-brand">Mensagens</h1>
        <p className="text-muted-foreground mt-1">Histórico de comunicações enviadas a pacientes, famílias e cuidadores.</p>
      </header>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {msgs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Nenhuma mensagem enviada ainda. Abra um paciente para enviar a primeira.</div>
        ) : (
          <ul className="divide-y divide-border">{msgs.map((m) => (
            <li key={m.id} className="p-4">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span><span className="uppercase font-semibold text-brand">{m.channel}</span> → <Link to={`/app/pacientes/${m.patient_id}`} className="hover:underline">{m.patients?.full_name}</Link></span>
                <span>{m.sent_at ? new Date(m.sent_at).toLocaleString("pt-BR") : ""}</span>
              </div>
              <div className="mt-1 text-sm">{m.body}</div>
            </li>
          ))}</ul>
        )}
      </div>
    </div>
  );
}