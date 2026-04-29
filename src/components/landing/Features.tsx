import { Apple, Pill, HeartPulse, UserCircle, MessageCircle, ShieldCheck } from "lucide-react";

const features = [
  { icon: Apple, title: "Guia Alimentar Personalizado", desc: "Dicas e orientações nutricionais adaptadas para quem convive com a doença de Chagas, considerando o estágio clínico e o perfil de cada paciente." },
  { icon: Pill, title: "Lembretes de Medicação", desc: "Notificações automáticas que reforçam a importância de tomar o medicamento no horário certo e de manter a regularidade do tratamento." },
  { icon: HeartPulse, title: "Cuidados com a Saúde", desc: "Orientações sobre qualidade do sono, atividade física e hábitos diários que complementam o tratamento e melhoram a qualidade de vida." },
  { icon: UserCircle, title: "Comunicação por Perfil de Paciente", desc: "Mensagens adaptadas a diferentes personas — do jovem que suspeita de infecção ao paciente crônico com baixa adesão — garantindo relevância e empatia em cada contato." },
  { icon: MessageCircle, title: "WhatsApp Integrado", desc: "Envio 1:1 ou em massa de mensagens automáticas, com templates personalizáveis por perfil de paciente." },
  { icon: ShieldCheck, title: "Conformidade LGPD", desc: "Dados protegidos, criptografados e em conformidade com a legislação brasileira." },
];

export const Features = () => (
  <section id="funcionalidades" className="py-24">
    <div className="container">
      <div className="mx-auto mb-16 max-w-2xl text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand/70">Funcionalidades</p>
        <h2 className="font-display text-3xl font-bold text-brand md:text-4xl lg:text-5xl">
          Ferramentas poderosas para engajar pacientes de Chagas
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Tudo o que sua equipe precisa para entregar educação, suporte e cuidado contínuo a cada perfil de paciente.
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