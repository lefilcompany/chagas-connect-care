import {
  PlayCircle, Bell, Users, GitBranch, MessageCircle, Smartphone, Mail,
  ShieldCheck, Clock, CheckCircle2, ListTodo, Megaphone, UserPlus, Flag,
  type LucideIcon,
} from "lucide-react";
import type { JourneyNodeKind } from "./types";

export type NodeMeta = {
  kind: JourneyNodeKind;
  label: string;
  icon: LucideIcon;
  tone: "entry" | "signal" | "audience" | "logic" | "channel" | "wait" | "task" | "end";
  hint: string;
};

export const NODE_CATALOG: NodeMeta[] = [
  { kind: "entrada", label: "Entrada", icon: PlayCircle, tone: "entry", hint: "Como a pessoa entra nesta jornada" },
  { kind: "evento", label: "Evento", icon: Bell, tone: "signal", hint: "Gatilho a partir de um evento clínico ou operacional" },
  { kind: "audiencia", label: "Audiência", icon: Users, tone: "audience", hint: "Filtra por um segmento salvo" },
  { kind: "condicao", label: "Condição", icon: GitBranch, tone: "logic", hint: "Ramifica com base em uma regra" },
  { kind: "whatsapp", label: "WhatsApp", icon: MessageCircle, tone: "channel", hint: "Envia um modelo Meta aprovado" },
  { kind: "sms", label: "SMS", icon: Smartphone, tone: "channel", hint: "Envia mensagem curta (canal futuro)" },
  { kind: "email", label: "E-mail", icon: Mail, tone: "channel", hint: "Envia e-mail (canal futuro)" },
  { kind: "pagina-segura", label: "Página segura", icon: ShieldCheck, tone: "channel", hint: "Envia link autenticado" },
  { kind: "aguardar", label: "Aguardar", icon: Clock, tone: "wait", hint: "Espera por tempo ou até uma data" },
  { kind: "verificar-resposta", label: "Verificar resposta", icon: CheckCircle2, tone: "logic", hint: "Confere se a pessoa respondeu" },
  { kind: "criar-tarefa", label: "Criar tarefa", icon: ListTodo, tone: "task", hint: "Gera tarefa para a equipe" },
  { kind: "notificar-equipe", label: "Notificar equipe", icon: Megaphone, tone: "task", hint: "Envia aviso interno" },
  { kind: "encaminhar-humano", label: "Encaminhar humano", icon: UserPlus, tone: "task", hint: "Transfere para atendimento humano" },
  { kind: "encerrar", label: "Encerrar", icon: Flag, tone: "end", hint: "Finaliza a jornada da pessoa" },
];

export function nodeMeta(kind: JourneyNodeKind): NodeMeta {
  return NODE_CATALOG.find((n) => n.kind === kind) ?? NODE_CATALOG[0];
}

export const TONE_STYLES: Record<NodeMeta["tone"], string> = {
  entry: "bg-mint-soft text-care border-care/30",
  signal: "bg-coral-soft text-primary border-coral/40",
  audience: "bg-secondary text-ink border-border",
  logic: "bg-secondary text-ink border-border",
  channel: "bg-mint-soft text-care border-care/30",
  wait: "bg-secondary text-muted-foreground border-border",
  task: "bg-coral-soft text-primary border-coral/40",
  end: "bg-muted text-muted-foreground border-border",
};