import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Copy, ShieldCheck, ShieldOff, StickyNote, User, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CareOrbit } from "@/features/people/CareOrbit";
import { usePeopleWithDerived } from "@/features/people/usePeople";
import { getWindowStatus, formatWindowLabel } from "@/lib/whatsapp";
import type { InboxConversation } from "./useInbox";

function notesKey(id: string) {
  return `inbox-notes:${id}`;
}

export function ConversationContext({
  conversation,
  onInvite,
}: {
  conversation: InboxConversation;
  onInvite: () => void;
}) {
  const { data: people } = usePeopleWithDerived();
  const person = people?.find((p) => p.id === conversation.patient_id) ?? null;
  const windowStatus = getWindowStatus(conversation.service_window_expires_at);

  const [note, setNote] = useState("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    setNote(window.localStorage.getItem(notesKey(conversation.identity_id)) ?? "");
  }, [conversation.identity_id]);

  const saveNote = () => {
    window.localStorage.setItem(notesKey(conversation.identity_id), note);
    toast.success("Nota interna salva");
  };

  const copyPhone = async () => {
    if (!conversation.phone) return;
    await navigator.clipboard.writeText(conversation.phone);
    toast.success("Telefone copiado");
  };

  return (
    <aside className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <section className="care-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Pessoa</p>
            <h3 className="font-display text-base font-semibold text-ink truncate">
              {conversation.display_name}
            </h3>
            <p className="text-xs text-muted-foreground">{conversation.phone || "—"}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={copyPhone} aria-label="Copiar telefone">
            <Copy className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <div className="mt-3 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Janela WhatsApp</span>
            <span className={windowStatus.state === "open" ? "text-care" : "text-muted-foreground"}>
              {formatWindowLabel(windowStatus)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status do contato</span>
            {conversation.is_known ? (
              <span className="inline-flex items-center gap-1 text-care">
                <ShieldCheck className="h-3 w-3" aria-hidden /> Cadastrado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-coral-strong">
                <ShieldOff className="h-3 w-3" aria-hidden /> Desconhecido
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {conversation.patient_id && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/app/pessoas/${conversation.patient_id}`}>
                <User className="h-4 w-4" /> Perfil 360°
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          )}
          {!conversation.is_known && (
            <Button variant="hero" size="sm" onClick={onInvite}>
              <UserPlus className="h-4 w-4" /> Convidar cadastro
            </Button>
          )}
        </div>
      </section>

      {conversation.patient_id && person && (
        <CareOrbit patientId={conversation.patient_id} patientName={person.full_name} />
      )}

      <section className="care-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="inline-flex items-center gap-2 font-display text-sm font-semibold text-ink">
            <StickyNote className="h-4 w-4" aria-hidden /> Nota interna
          </h3>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Não enviada ao paciente</span>
        </div>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Registro visível apenas para a equipe (armazenamento local do navegador)."
          className="min-h-[100px] resize-y text-sm"
        />
        <div className="mt-2 flex justify-end">
          <Button variant="outline" size="sm" onClick={saveNote}>
            Salvar nota
          </Button>
        </div>
      </section>

    </aside>
  );
}