import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Copy,
  Network,
  ShieldCheck,
  ShieldOff,
  StickyNote,
  User,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/care/EmptyState";
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
  const person = people?.find((item) => item.id === conversation.patient_id) ?? null;
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
    <Tabs defaultValue="pessoa" className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border bg-card px-4 py-3">
        <TabsList className="grid w-full grid-cols-3 rounded-xl bg-secondary p-1">
          <TabsTrigger value="pessoa" className="gap-1.5 rounded-lg text-xs">
            <User className="h-3.5 w-3.5" aria-hidden /> Pessoa
          </TabsTrigger>
          <TabsTrigger value="rede" className="gap-1.5 rounded-lg text-xs">
            <Network className="h-3.5 w-3.5" aria-hidden /> Rede
          </TabsTrigger>
          <TabsTrigger value="notas" className="gap-1.5 rounded-lg text-xs">
            <StickyNote className="h-3.5 w-3.5" aria-hidden /> Notas
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-background p-4 sm:p-5">
        <TabsContent value="pessoa" className="m-0 space-y-4">
          <section className="care-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Pessoa</p>
                <h2 className="mt-1 truncate font-display text-lg font-semibold text-ink">
                  {conversation.display_name}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{conversation.phone || "Telefone não informado"}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={copyPhone} aria-label="Copiar telefone" disabled={!conversation.phone}>
                <Copy className="h-4 w-4" aria-hidden />
              </Button>
            </div>

            <dl className="mt-5 space-y-3 rounded-xl bg-secondary/60 p-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-muted-foreground">Janela WhatsApp</dt>
                <dd className={windowStatus.state === "open" ? "text-right font-medium text-care" : "text-right text-muted-foreground"}>
                  {formatWindowLabel(windowStatus)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-muted-foreground">Status do contato</dt>
                <dd>
                  {conversation.is_known ? (
                    <span className="inline-flex items-center gap-1 font-medium text-care">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Cadastrado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-medium text-coral-strong">
                      <ShieldOff className="h-3.5 w-3.5" aria-hidden /> Desconhecido
                    </span>
                  )}
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-2">
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

          <section className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-display text-sm font-semibold text-ink">Resumo operacional</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Consulte a rede vinculada na aba “Rede” e registre observações internas na aba “Notas”. Essas informações não são enviadas automaticamente à pessoa.
            </p>
          </section>
        </TabsContent>

        <TabsContent value="rede" className="m-0">
          {conversation.patient_id && person ? (
            <CareOrbit patientId={conversation.patient_id} patientName={person.full_name} />
          ) : (
            <EmptyState
              icon={UsersRound}
              title="Rede de cuidado indisponível"
              description={
                conversation.is_known
                  ? "Não foi possível localizar os vínculos desta pessoa."
                  : "Convide o contato para cadastro antes de associar familiares, cuidadores ou profissionais."
              }
              action={!conversation.is_known ? (
                <Button variant="hero" size="sm" onClick={onInvite}>
                  <UserPlus className="h-4 w-4" /> Convidar cadastro
                </Button>
              ) : undefined}
            />
          )}
        </TabsContent>

        <TabsContent value="notas" className="m-0">
          <section className="care-card p-5">
            <div className="mb-3">
              <h3 className="inline-flex items-center gap-2 font-display text-base font-semibold text-ink">
                <StickyNote className="h-4 w-4" aria-hidden /> Nota interna
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Registro visível apenas neste navegador. O conteúdo não é enviado ao paciente ou contato.
              </p>
            </div>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Registre aqui um contexto útil para a equipe."
              className="min-h-[220px] resize-y text-sm"
            />
            <div className="mt-3 flex justify-end">
              <Button variant="hero" size="sm" onClick={saveNote}>
                Salvar nota
              </Button>
            </div>
          </section>
        </TabsContent>
      </div>
    </Tabs>
  );
}
