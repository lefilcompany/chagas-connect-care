import { Apple, Pill, HeartPulse, Users, MessageCircle, Plug } from "lucide-react";

const features = [
  { icon: Users, title: "Cuidado em Rede", desc: "Inclua paciente, familiares e cuidadores na mesma jornada, com mensagens direcionadas para cada papel no cuidado." },
  { icon: Pill, title: "Lembretes de Medicação", desc: "Notificações via WhatsApp ou SMS para o paciente e para o responsável, reforçando horários e regularidade do tratamento." },
  { icon: Apple, title: "Guia Alimentar e Hábitos", desc: "Pacientes com Doença de Chagas têm risco aumentado de morte súbita sem controle adequado da dieta. Orientações nutricionais, sono e atividade física adaptadas ao estágio clínico ajudam familiares a gerenciar a dieta com segurança e reduzir riscos de arritmias potencialmente letais." },
  { icon: HeartPulse, title: "Acompanhamento da Jornada", desc: "Do diagnóstico ao cuidado crônico: conteúdos e check-ins evoluem com o paciente e mantêm a família informada em cada etapa." },
  { icon: MessageCircle, title: "WhatsApp e SMS Integrados", desc: "Comunicação 1:1 ou em massa com pacientes, famílias e cuidadores — com fallback automático para SMS quando o WhatsApp não está disponível." },
  { icon: Plug, title: "Integração com CRMs", desc: "Conecte a plataforma ao CRM que sua equipe já utiliza e mantenha dados de pacientes e responsáveis sincronizados em um só lugar." },
];

export const Features = () => (
  <section id="funcionalidades" className="py-24">
    <div className="container">
      <div className="mx-auto mb-16 max-w-2xl text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand">Funcionalidades</p>
        <h2 className="font-display text-3xl font-bold text-brand md:text-4xl lg:text-5xl">
          Ferramentas para apoiar pacientes, famílias e cuidadores
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Tudo o que sua equipe precisa para acompanhar toda a jornada do cuidado — com mensagens via WhatsApp ou SMS que chegam a cada pessoa envolvida.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="group relative rounded-2xl border border-border bg-card p-7 shadow-card transition-smooth hover:-translate-y-1 hover:border-primary hover:shadow-soft"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-brand transition-smooth group-hover:bg-brand group-hover:text-brand-foreground">
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