import { MessageCircle, Mail, Phone, Lock, MessageSquare, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Channel = "whatsapp" | "sms" | "email" | "voice" | "secure_page";

const map: Record<Channel, { label: string; icon: LucideIcon }> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  sms: { label: "SMS", icon: MessageSquare },
  email: { label: "E-mail", icon: Mail },
  voice: { label: "Voz", icon: Phone },
  secure_page: { label: "Página segura", icon: Lock },
};

export function ChannelBadge({ channel, className }: { channel: Channel; className?: string }) {
  const c = map[channel] ?? map.whatsapp;
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground", className)}>
      <Icon className="h-3 w-3" aria-hidden />
      {c.label}
    </span>
  );
}