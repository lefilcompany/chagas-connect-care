import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Send, UserPlus, Clock, AlertCircle, MessageCircle } from "lucide-react";
import { Paperclip, X, Loader2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatWindowLabel, getWindowStatus } from "@/lib/whatsapp";
import { queueAndSend } from "@/lib/whatsapp";
import { uploadWhatsAppMedia, type UploadedMediaAsset } from "@/lib/whatsappMedia";

type ConvRow = {
  identity_id: string;
  institution: string;
  patient_id: string | null;
  contact_id: string | null;
  service_window_expires_at: string | null;
  last_message_at: string | null;
  display_name: string;
  is_known: boolean;
  unread: number;
  last_body: string;
  phone: string;
};

type Msg = {
  id: string;
  direction: string;
  body: string;
  sent_at: string | null;
  status: string | null;
  read_at: string | null;
  media_asset_id: string | null;
  media_filename: string | null;
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

const URL_RE = /(https?:\/\/[^\s]+)/g;
function renderWithLinks(text: string) {
  if (!text) return null;
  const parts = text.split(URL_RE);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-medium break-all hover:opacity-80"
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const d = Date.now() - new Date(iso).getTime();
  const mins = Math.round(d / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h`;
  const days = Math.round(h / 24);
  return `${days}d`;
}

export default function Conversas() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [institution, setInstitution] = useState<string>("");
  const [activeIdentity, setActiveIdentity] = useState<string | null>(null);
  const [composer, setComposer] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [attachment, setAttachment] = useState<UploadedMediaAsset | null>(null);
  const [attachmentName, setAttachmentName] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const MAX_TEXT = 4096;

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("institution").eq("id", user.id).maybeSingle()
      .then(({ data }) => setInstitution((data as any)?.institution ?? ""));
  }, [user]);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["inbox-conversations", institution],
    queryFn: async () => {
      const { data: convs } = await supabase
        .from("whatsapp_conversations")
        .select("identity_id, institution, patient_id, contact_id, service_window_expires_at, last_message_at")
        .eq("institution", institution)
        .order("last_message_at", { ascending: false })
        .limit(100);
      const list = (convs ?? []) as any[];
      if (!list.length) return [] as ConvRow[];
      const identityIds = list.map((c) => c.identity_id);
      const { data: idents } = await supabase
        .from("whatsapp_identities")
        .select("id, display_name, phone_e164, patient_id, contact_id")
        .in("id", identityIds);
      const identMap = new Map((idents ?? []).map((i: any) => [i.id, i]));
      const { data: lastMsgs } = await supabase
        .from("messages")
        .select("identity_id, body, sent_at, direction, read_at, status")
        .in("identity_id", identityIds)
        .order("sent_at", { ascending: false })
        .limit(500);
      const lastByIdent = new Map<string, any>();
      const unreadByIdent = new Map<string, number>();
      for (const m of (lastMsgs ?? []) as any[]) {
        if (!lastByIdent.has(m.identity_id)) lastByIdent.set(m.identity_id, m);
        if (m.direction === "inbound" && !m.read_at) {
          unreadByIdent.set(m.identity_id, (unreadByIdent.get(m.identity_id) ?? 0) + 1);
        }
      }
      // Names for known patients / contacts
      const patientIds = list.map((c) => c.patient_id).filter(Boolean) as string[];
      const contactIds = list.map((c) => c.contact_id).filter(Boolean) as string[];
      const [pats, cons] = await Promise.all([
        patientIds.length
          ? supabase.from("patients").select("id, full_name").in("id", patientIds)
          : Promise.resolve({ data: [] as any[] }),
        contactIds.length
          ? supabase.from("contacts").select("id, full_name").in("id", contactIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const patMap = new Map((pats.data ?? []).map((p: any) => [p.id, p.full_name]));
      const conMap = new Map((cons.data ?? []).map((c: any) => [c.id, c.full_name]));
      return list.map((c) => {
        const ident = identMap.get(c.identity_id) as any;
        const isKnown = !!(c.patient_id || c.contact_id);
        const display =
          conMap.get(c.contact_id) ||
          patMap.get(c.patient_id) ||
          ident?.display_name ||
          ident?.phone_e164 ||
          "Desconhecido";
        const last = lastByIdent.get(c.identity_id);
        return {
          identity_id: c.identity_id,
          institution: c.institution,
          patient_id: c.patient_id,
          contact_id: c.contact_id,
          service_window_expires_at: c.service_window_expires_at,
          last_message_at: c.last_message_at ?? last?.sent_at ?? null,
          display_name: display,
          is_known: isKnown,
          unread: unreadByIdent.get(c.identity_id) ?? 0,
          last_body: last?.body ?? "",
          phone: ident?.phone_e164 ?? "",
        } as ConvRow;
      });
    },
    enabled: !!institution,
  });

  const activeConv = useMemo(
    () => (conversations ?? []).find((c) => c.identity_id === activeIdentity) ?? null,
    [conversations, activeIdentity],
  );

  const { data: thread } = useQuery({
    queryKey: ["inbox-thread", activeIdentity],
    queryFn: async () => {
      if (!activeIdentity) return [] as Msg[];
      const { data } = await supabase
        .from("messages")
        .select("id, direction, body, sent_at, status, read_at, media_asset_id, media_filename")
        .eq("identity_id", activeIdentity)
        .order("sent_at", { ascending: true })
        .limit(300);
      return (data ?? []) as Msg[];
    },
    enabled: !!activeIdentity,
  });

  // Realtime: refetch on any change for this institution
  useEffect(() => {
    if (!institution) return;
    const channel = supabase
      .channel(`inbox-${institution}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["inbox-conversations", institution] });
        if (activeIdentity) qc.invalidateQueries({ queryKey: ["inbox-thread", activeIdentity] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations" }, () => {
        qc.invalidateQueries({ queryKey: ["inbox-conversations", institution] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [institution, activeIdentity, qc]);

  // Mark inbound as read when opening
  useEffect(() => {
    if (!activeIdentity) return;
    supabase.from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("identity_id", activeIdentity)
      .eq("direction", "inbound")
      .is("read_at", null)
      .then(() => qc.invalidateQueries({ queryKey: ["inbox-conversations", institution] }));
  }, [activeIdentity, institution, qc]);

  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [thread?.length, activeIdentity]);

  const windowStatus = getWindowStatus(activeConv?.service_window_expires_at ?? null);
  const windowOpen = windowStatus.state === "open";

  async function handleSend() {
    if (!activeConv) return;
    if (!composer.trim() && !attachment) return;
    if (!windowOpen) {
      toast.error("Janela de 24h fechada. Use um Template Meta de Utilidade.");
      return;
    }
    const text = composer.trim();
    const att = attachment;
    const attName = attachmentName;
    setSending(true);
    setComposer("");
    setAttachment(null);
    setAttachmentName("");
    const res = await queueAndSend({
      patient_id: activeConv.patient_id,
      contact_id: activeConv.contact_id,
      identity_id: activeConv.identity_id,
      institution: activeConv.institution,
      body: text,
      message_type: "inbox_reply",
      created_by: user?.id ?? null,
      media_asset_id: att?.media_asset_id ?? null,
      media_filename: att?.media_type === "document" ? attName : null,
    });
    setSending(false);
    if (!res.ok) {
      toast.error(res.error ?? "Falha ao enviar");
      // Restore composer so the user doesn't lose what they wrote
      setComposer(text);
      if (att) {
        setAttachment(att);
        setAttachmentName(attName);
      }
    }
    qc.invalidateQueries({ queryKey: ["inbox-thread", activeConv.identity_id] });
    qc.invalidateQueries({ queryKey: ["inbox-conversations", institution] });
  }

  async function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
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
    toast.success("Mídia pronta para enviar");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-brand">Conversas</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe cada conversa de WhatsApp em tempo real, respeitando a janela gratuita de 24h.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 h-[calc(100vh-220px)]">
        {/* List */}
        <Card className="flex flex-col overflow-hidden">
          <div className="p-3 border-b text-sm font-semibold flex items-center gap-2">
            <MessageCircle className="h-4 w-4" /> Caixa de entrada
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-3 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (conversations?.length ?? 0) === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma conversa ainda. Mensagens recebidas aparecerão aqui.
              </div>
            ) : (
              <ul>
                {conversations!.map((c) => {
                  const ws = getWindowStatus(c.service_window_expires_at);
                  return (
                    <li key={c.identity_id}>
                      <button
                        type="button"
                        onClick={() => setActiveIdentity(c.identity_id)}
                        className={cn(
                          "w-full text-left flex gap-3 p-3 border-b hover:bg-muted/50 transition-colors",
                          activeIdentity === c.identity_id && "bg-muted",
                        )}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{initials(c.display_name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm truncate">{c.display_name}</span>
                            <span className="text-xs text-muted-foreground shrink-0">{timeAgo(c.last_message_at)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{c.last_body || "—"}</div>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {!c.is_known && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5">Desconhecido</Badge>
                            )}
                            {ws.state === "open" && (
                              <Badge className="text-[10px] py-0 px-1.5 bg-green-100 text-green-700 hover:bg-green-100">
                                <Clock className="h-2.5 w-2.5 mr-0.5" /> 24h ativa
                              </Badge>
                            )}
                            {c.unread > 0 && (
                              <Badge className="text-[10px] py-0 px-1.5">{c.unread}</Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        {/* Conversation */}
        <Card className="flex flex-col overflow-hidden">
          {!activeConv ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Selecione uma conversa para começar.
            </div>
          ) : (
            <>
              <div className="p-3 border-b flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{activeConv.display_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{activeConv.phone}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xs px-2 py-1 rounded-full",
                    windowOpen ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700",
                  )}>
                    {formatWindowLabel(windowStatus)}
                  </span>
                  {!activeConv.is_known && (
                    <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
                      <UserPlus className="h-4 w-4" /> Convidar para cadastro
                    </Button>
                  )}
                </div>
              </div>

              <div ref={scroller} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
                {(thread ?? []).map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words shadow-sm",
                      m.direction === "inbound"
                        ? "bg-card text-foreground self-start mr-auto"
                        : "bg-primary text-primary-foreground self-end ml-auto",
                    )}
                  >
                    {m.media_asset_id && (
                      <div className="flex items-center gap-1.5 text-xs opacity-90 mb-1 border-b border-current/20 pb-1">
                        <Paperclip className="h-3 w-3" />
                        <span className="truncate">{m.media_filename || "Anexo"}</span>
                      </div>
                    )}
                    {m.body && renderWithLinks(m.body)}
                    <div className="text-[10px] opacity-70 mt-1">
                      {m.sent_at ? new Date(m.sent_at).toLocaleString() : ""}
                      {m.direction === "outbound" && m.status ? ` · ${m.status}` : ""}
                    </div>
                  </div>
                ))}
                {(thread?.length ?? 0) === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-10">
                    Sem mensagens ainda nesta conversa.
                  </div>
                )}
              </div>


              <div className="p-3 border-t">
                {windowOpen ? (
                  <div className="space-y-2">
                    {attachment && (
                      <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5 text-xs">
                        {attachment.media_type === "image" ? (
                          <Paperclip className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <FileText className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                        <span className="flex-1 truncate">
                          {attachmentName} ·{" "}
                          <span className="text-muted-foreground">
                            {attachment.media_type} · {(attachment.size_bytes / 1024).toFixed(0)} KB
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => { setAttachment(null); setAttachmentName(""); }}
                          className="rounded p-1 hover:bg-muted"
                          aria-label="Remover anexo"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    <div className="flex gap-2 items-end">
                      <input
                        ref={fileRef}
                        type="file"
                        className="hidden"
                        accept="image/jpeg,image/png,video/mp4,video/3gpp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        onChange={handlePickFile}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading || sending || !!attachment}
                        title="Anexar imagem, vídeo ou documento"
                      >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                      </Button>
                      <div className="flex-1">
                        <Textarea
                          value={composer}
                          onChange={(e) => setComposer(e.target.value.slice(0, MAX_TEXT))}
                          placeholder={attachment ? "Adicione uma legenda (opcional)…" : "Escreva uma resposta… (Enter envia, Shift+Enter quebra linha)"}
                          className="min-h-[60px] resize-none"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                              e.preventDefault();
                              handleSend();
                            }
                          }}
                        />
                        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                          <span>Janela 24h aberta · respostas livres permitidas</span>
                          <span className={cn(composer.length > MAX_TEXT * 0.9 && "text-amber-600")}>
                            {composer.length}/{MAX_TEXT}
                          </span>
                        </div>
                      </div>
                      <Button
                        onClick={handleSend}
                        disabled={sending || uploading || (!composer.trim() && !attachment)}
                      >
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Enviar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    Janela de 24h fechada. Envie um Template Meta de UTILIDADE pela tela de Mensagens.
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      {activeConv && (
        <InviteDialog
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          identityId={activeConv.identity_id}
          institution={institution}
          windowOpen={windowOpen}
        />
      )}
    </div>
  );
}

function InviteDialog({
  open, onClose, identityId, institution, windowOpen,
}: {
  open: boolean; onClose: () => void; identityId: string; institution: string; windowOpen: boolean;
}) {
  const [role, setRole] = useState<"paciente" | "familiar" | "cuidador">("paciente");
  const [patientId, setPatientId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [sending, setSending] = useState(false);

  const { data: patients } = useQuery({
    queryKey: ["inv-patients", institution],
    queryFn: async () => {
      const { data } = await supabase.from("patients").select("id, full_name").order("full_name").limit(200);
      return (data ?? []) as any[];
    },
    enabled: open,
  });

  const { data: utilityTemplates } = useQuery({
    queryKey: ["inv-utility-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("message_templates")
        .select("id, name, meta_status, meta_category")
        .eq("meta_category", "UTILITY")
        .eq("meta_status", "approved");
      return (data ?? []) as any[];
    },
    enabled: open && !windowOpen,
  });

  async function submit() {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-onboarding-invite", {
        body: {
          identity_id: identityId,
          intended_role: role,
          patient_id: role === "paciente" ? null : (patientId || null),
          public_base_url: window.location.origin,
          template_id: windowOpen ? null : (templateId || null),
        },
      });
      if (error) throw error;
      if ((data as any)?.ok === false) throw new Error((data as any)?.error ?? "Falha ao enviar convite");
      toast.success("Convite enviado pelo WhatsApp");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar convite");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar para cadastro</DialogTitle>
          <DialogDescription>
            Envia uma mensagem de WhatsApp com um botão que leva a um formulário público de cadastro.
            {windowOpen
              ? " A janela de 24h está aberta — será enviada uma mensagem interativa gratuita."
              : " A janela está fechada — selecione um Template Meta de UTILIDADE aprovado."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tipo de cadastro</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paciente">Paciente</SelectItem>
                <SelectItem value="familiar">Familiar</SelectItem>
                <SelectItem value="cuidador">Cuidador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {role !== "paciente" && (
            <div>
              <Label>Paciente vinculado</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                <SelectContent>
                  {(patients ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {!windowOpen && (
            <div>
              <Label>Template Meta de UTILIDADE</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder="Selecione um template aprovado" /></SelectTrigger>
                <SelectContent>
                  {(utilityTemplates ?? []).length === 0 ? (
                    <SelectItem value="__none" disabled>Nenhum template de UTILIDADE aprovado</SelectItem>
                  ) : (
                    utilityTemplates!.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={submit}
            disabled={sending || (role !== "paciente" && !patientId) || (!windowOpen && !templateId)}
          >
            Enviar convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}