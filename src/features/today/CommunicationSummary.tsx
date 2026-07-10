import { Send, CheckCheck, MessageCircleReply, Activity, type LucideIcon } from "lucide-react";
import { useTodayStats } from "./useTodayStats";

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number | string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-mint-soft text-care">
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-display text-2xl font-bold text-ink">{value}</div>
      </div>
    </div>
  );
}

export function CommunicationSummary() {
  const { data } = useTodayStats();
  const s = data?.summary;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Stat icon={Send} label="Enviadas hoje" value={s?.allToday ?? 0} />
      <Stat icon={CheckCheck} label="Entregues" value={s?.delivered ?? 0} />
      <Stat icon={MessageCircleReply} label="Respostas recebidas" value={s?.replied ?? 0} />
      <Stat icon={Activity} label="Pessoas alcançadas" value={s?.messagesToday ?? 0} />
    </div>
  );
}