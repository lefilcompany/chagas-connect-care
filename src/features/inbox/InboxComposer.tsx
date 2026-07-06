import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, BookOpen, FileText, Loader2, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { queueAndSend, getWindowStatus } from "@/lib/whatsapp";
import { uploadWhatsAppMedia, type UploadedMediaAsset } from "@/lib/whatsappMedia";
import { UseTemplateDialog } from "@/components/app/messages/UseTemplateDialog";
import { fetchers, qk } from "@/lib/queries";
import type { MessageTemplate } from "@/lib/templates";
import type { InboxConversation } from "./useInbox";
import { evaluatePrivacy, PrivacyCheck } from "@/features/privacy/PrivacyCheck";
import { MessageSafetyPreview, messageHasClinicalContent } from "@/features/privacy/MessageSafetyPreview";

const MAX_TEXT = 4096;

type Tab = "texto" | "template" | "biblioteca" | "anexo";

const tabs: Array<{ id: Tab; label: string; icon: typeof FileText }> = [
  { id: "texto", label: "Texto", icon: Send },
  { id: "template", label: "Template Meta", icon: FileText },
  { id: "biblioteca", label: "Conteúdo aprovado", icon: BookOpen },
  { id: "anexo", label: "Anexo", icon: Paperclip },
];

export function InboxComposer({
  conversation,
  userId,
}: {
  conversation: InboxConversation;
  userId: string | null;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("texto");
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<UploadedMediaAsset | null>(null);
  const [attachmentName, setAttachmentName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [pickedTemplate, setPickedTemplate] = useState<MessageTemplate | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const windowStatus = getWindowStatus(conversation.service_window_expires_at);
  const windowOpen = windowStatus.state === "open";
  const [ackClinical, setAckClinical] = useState(false);

  // Fetch consent + relation for the destinatário associado à conversa.
  const { data: recipientMeta } = useQuery({
    queryKey: ["inbox-recipient-meta", conversation.contact_id, conversation.patient_id],
    enabled: !!(conversation.contact_id || conversation.patient_id),
    queryFn: async () => {
      if (conversation.contact_id) {
        const { data } = await supabase
          .from("contacts")
          .select("authorization_status, relation")
          .eq("id", conversation.contact_id)
          .maybeSingle();
        return {
          consent: (data as any)?.authorization_status ?? null,
          relation: (data as any)?.relation ?? null,
        };
      }
      if (conversation.patient_id) {
        return { consent: "authorized", relation: "paciente" as string };
      }
      return { consent: null, relation: null };
    },
  });

  const { data: activeTemplates = [] } = useQuery({
    queryKey: qk.templates,
    queryFn: fetchers.templates as () => Promise<MessageTemplate[]>,
  });

  const { data: contentItems = [] } = useQuery({
    queryKey: ["content-library-inbox"],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_library")
        .select("id, title, body, category, audience")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: tab === "biblioteca",
  });

  const handlePickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const res = await uploadWhatsAppMedia(file);
    setUploading(false);
    if (!res.ok) {
      toast.error(("error" in res && res.error) || "Falha ao enviar mídia");
      return;
    }
    setAttachment(res.asset);
    setAttachmentName(file.name);
    setTab("anexo");
    toast.success("Mídia pronta para envio");
  };

  const handleSendText = async () => {
    if (!text.trim() && !attachment) return;
    if (!windowOpen) {
      toast.error("Janela de 24h fechada. Use um Template Meta para reabrir a conversa.");
      return;
    }
    const bodyForCheck = text.trim();
    const clinical = messageHasClinicalContent(bodyForCheck);
    const privacy = evaluatePrivacy({
      consent: recipientMeta?.consent,
      channel: "whatsapp",
      phone: conversation.phone,
      relation: recipientMeta?.relation,
      hasClinicalContent: clinical,
    });
    if (!privacy.ok) {
      toast.error(privacy.issues.find((i) => i.severity === "block")?.message ?? "Envio bloqueado por política");
      return;
    }
    const hasWarn = privacy.issues.some((i) => i.severity === "warn") || clinical;
    if (hasWarn && !ackClinical) {
      toast.error("Confirme os avisos de privacidade abaixo antes de enviar.");
      return;
    }
    setSending(true);
    const res = await queueAndSend({
      patient_id: conversation.patient_id,
      contact_id: conversation.contact_id,
      identity_id: conversation.identity_id,
      institution: conversation.institution,
      body: text.trim(),
      message_type: "inbox_reply",
      created_by: userId,
      media_asset_id: attachment?.media_asset_id ?? null,
      media_filename: attachment?.media_type === "document" ? attachmentName : null,
    });
    setSending(false);
    if (!res.ok) {
      toast.error(res.error ?? "Falha ao enviar");
      return;
    }
    setText("");
    setAttachment(null);
    setAttachmentName("");
    setAckClinical(false);
    qc.invalidateQueries({ queryKey: ["inbox-thread", conversation.identity_id] });
    qc.invalidateQueries({ queryKey: ["inbox-conversations", conversation.institution] });
    toast.success("Mensagem enviada");
  };

  const insertContent = (body: string) => {
    setText((cur) => (cur ? `${cur}\n\n${body}` : body).slice(0, MAX_TEXT));
    setTab("texto");
    toast.success("Conteúdo inserido no editor");
  };

  return (
    <div className="border-t border-border bg-card">
      <div role="tablist" aria-label="Tipo de mensagem" className="flex items-center gap-1 border-b border-border px-3 pt-2">
        {tabs.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-t-md border border-b-0 px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-border bg-background text-ink"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "texto" && (
        <div className="p-3">
          {!windowOpen && (
            <div className="mb-2 flex items-start gap-2 rounded-md border border-coral-strong/30 bg-coral-soft/60 px-3 py-2 text-xs text-coral-strong">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <p>
                Janela de 24h encerrada. Para reabrir a conversa, envie um Template Meta aprovado pela aba "Template Meta".
              </p>
            </div>
          )}
          {attachment && (
            <div className="mb-2 flex items-center gap-2 rounded-md border border-border bg-secondary/60 px-2 py-1.5 text-xs">
              <Paperclip className="h-3.5 w-3.5 text-care" aria-hidden />
              <span className="flex-1 truncate">
                {attachmentName} · <span className="text-muted-foreground">{attachment.media_type}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setAttachment(null);
                  setAttachmentName("");
                }}
                className="rounded p-1 hover:bg-muted"
                aria-label="Remover anexo"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          )}
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
            placeholder={
              attachment
                ? "Adicione uma legenda (opcional)…"
                : "Escreva uma resposta… (Enter envia, Shift+Enter quebra linha)"
            }
            className="min-h-[80px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSendText();
              }
            }}
          />
          <InboxPrivacyGate
            body={text}
            consent={recipientMeta?.consent}
            relation={recipientMeta?.relation}
            phone={conversation.phone}
            ack={ackClinical}
            onAckChange={setAckClinical}
          />
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,video/mp4,video/3gpp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handlePickFile}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || sending || !!attachment}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Paperclip className="h-4 w-4" aria-hidden />}
                Anexar
              </Button>
              <span className={cn("text-[10px] text-muted-foreground", text.length > MAX_TEXT * 0.9 && "text-coral-strong")}>
                {text.length}/{MAX_TEXT}
              </span>
            </div>
            <Button
              size="sm"
              variant="hero"
              onClick={handleSendText}
              disabled={sending || uploading || (!text.trim() && !attachment) || !windowOpen}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              Enviar
            </Button>
          </div>
        </div>
      )}

      {tab === "template" && (
        <div className="p-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Envie um modelo Meta aprovado. Necessário quando a janela de 24h está encerrada.
          </p>
          <div className="max-h-60 space-y-1 overflow-y-auto rounded-md border border-border">
            {activeTemplates.filter((t) => t.is_active).length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">Nenhum modelo aprovado disponível.</p>
            ) : (
              activeTemplates
                .filter((t) => t.is_active)
                .map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setPickedTemplate(t);
                      setTemplateOpen(true);
                    }}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{t.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {(t as any).meta_category ?? "—"} · {(t as any).meta_status ?? "—"}
                      </p>
                    </div>
                  </button>
                ))
            )}
          </div>
          <UseTemplateDialog
            open={templateOpen}
            onOpenChange={(o) => {
              setTemplateOpen(o);
              if (!o) setPickedTemplate(null);
            }}
            template={pickedTemplate}
            lockedPatientId={conversation.patient_id ?? undefined}
            initialMode={conversation.patient_id ? "patient" : undefined}
          />
        </div>
      )}

      {tab === "biblioteca" && (
        <div className="p-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Insira um conteúdo aprovado da biblioteca no editor de texto.
          </p>
          <div className="max-h-60 space-y-1 overflow-y-auto rounded-md border border-border">
            {contentItems.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">Nenhum conteúdo cadastrado ainda.</p>
            ) : (
              contentItems.map((c: any) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => insertContent(c.body)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{c.title}</p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{c.body}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "anexo" && (
        <div className="p-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Envie imagem, vídeo ou documento junto de uma legenda opcional. A janela de 24h precisa estar ativa.
          </p>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,video/mp4,video/3gpp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handlePickFile}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || !!attachment}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Paperclip className="h-4 w-4" aria-hidden />}
              Escolher arquivo
            </Button>
            {attachment && (
              <span className="text-xs text-muted-foreground">
                {attachmentName} · {attachment.media_type}
              </span>
            )}
          </div>
          {attachment && (
            <Button
              variant="hero"
              size="sm"
              className="mt-3"
              onClick={() => {
                setTab("texto");
                setTimeout(handleSendText, 0);
              }}
              disabled={sending || !windowOpen}
            >
              <Send className="h-4 w-4" /> Enviar anexo
            </Button>
          )}
        </div>
      )}
    </div>
  );
}