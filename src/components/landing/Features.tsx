import { Users, ListOrdered, Activity, CalendarCheck, MessageCircle, ShieldCheck } from "lucide-react";

const features = [
  { icon: Users, title: "CRM de Pacientes", desc: "Gestão completa de cadastro, dados clínicos e histórico de cada paciente em um só lugar." },
  { icon: ListOrdered, title: "Priorização Clínica", desc: "Ranqueamento inteligente de pacientes por urgência, gravidade e tempo de espera." },
  { icon: Activity, title: "Linha do Tempo", desc: "Histórico cronológico de todas as interações, consultas e eventos clínicos do paciente." },
  { icon: CalendarCheck, title: "Consultas", desc: "Agendamento, status em tempo real e integração com lembretes automáticos." },
  { icon: MessageCircle, title: "WhatsApp Integrado", desc: "Envio 1:1 ou em massa de mensagens automáticas, com templates personalizáveis." },
  { icon: ShieldCheck, title: "Conformidade LGPD", desc: "Dados protegidos, criptografados e em conformidade com a legislação brasileira." },
];

export const Features = () => (
  <section id="funcionalidades" className="py-24">
    <div className="container">
      <div className="mx-auto mb-16 max-w-2xl text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand/70">Funcionalidades</p>
        <h2 className="font-display text-3xl font-bold text-brand md:text-4xl lg:text-5xl">
          Ferramentas poderosas para otimizar o acompanhamento
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Tudo o que sua equipe precisa para entregar cuidado contínuo e de qualidade.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="group relative rounded-2xl border border-border bg-card p-7 shadow-card transition-smooth hover:-translate-y-1 hover:border-primary hover:shadow-soft"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/50 text-brand transition-smooth group-hover:bg-brand group-hover:text-brand-foreground">
              <f.icon className="h-6 w-6" />
            </div>
            <h3 className="mb-2 font-display text-xl font-bold text-brand">{f.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);