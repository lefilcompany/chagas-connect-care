/**
 * Rich descriptions that explain how each template communicates via WhatsApp.
 * Falls back to the template's own description when no override exists.
 */
export const WHATSAPP_DESCRIPTIONS: Record<string, string> = {
  "Lembrete de medicação":
    "Envia lembrete automático no WhatsApp sobre horário e dose da medicação para o paciente ou familiar",
  "Lembrete de consulta":
    "Avisa pelo WhatsApp sobre consulta agendada com data, hora e local para o paciente ou acompanhante",
  "Confirmação de recebimento":
    "Confirma pelo WhatsApp que a mensagem do paciente ou familiar foi recebida pela equipe",
  "Acompanhamento de adesão":
    "Pergunta pelo WhatsApp como está a adesão ao tratamento do paciente ou familiar",
  "Cuidados de rotina":
    "Manda orientação de cuidados diários pelo WhatsApp para paciente ou cuidador reforçar em casa",
  "Boas-vindas":
    "Envia mensagem de boas-vindas pelo WhatsApp ao novo paciente ou familiar no acompanhamento",
  "Aviso do ambulatório":
    "Envia avisos curtos da equipe pelo WhatsApp sobre mudanças, horários ou comunicados do ambulatório",
  "Alimentação saudável":
    "Envia dica de alimentação saudável pelo WhatsApp para paciente ou cuidador aplicar no dia a dia",
  "Orientação de saúde":
    "Compartilha orientação geral de saúde pelo WhatsApp para paciente ou familiar acompanhar o tratamento",
};

export function getTemplateDescription(name: string, fallback: string): string {
  return WHATSAPP_DESCRIPTIONS[name] ?? fallback;
}
