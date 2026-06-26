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
  "Lembrete de medicação (Utilidade)":
    "Template Meta de UTILIDADE com botões para o paciente ou familiar confirmar se conseguiu tomar a medicação",
  "Confirmação de medicação (Autenticação)":
    "Template Meta de AUTENTICAÇÃO que envia código copiável para registrar com segurança a tomada da medicação",
  "Lembrete de consulta (Utilidade)":
    "Template Meta de UTILIDADE com botões para confirmar presença ou pedir remarcação da consulta",
  "Campanha de retorno (Marketing)":
    "Template Meta de MARKETING que reativa pacientes inativos convidando a agendar uma nova consulta",
  "Acompanhamento de adesão (Utilidade)":
    "Template Meta de UTILIDADE para pesquisar rapidamente como foi a adesão da semana com botões de resposta",
  "Engajamento de adesão (Marketing)":
    "Template Meta de MARKETING motivacional para reforçar a continuidade do tratamento com link de apoio",
  "Dica de alimentação (Utilidade)":
    "Template Meta de UTILIDADE com dica curta de alimentação saudável e botões de confirmação",
  "Campanha de hábitos saudáveis (Marketing)":
    "Template Meta de MARKETING que estimula novos hábitos alimentares com convite para participar",
  "Orientação de cuidado (Utilidade)":
    "Template Meta de UTILIDADE para envio formal de orientações clínicas com botões de confirmação",
  "Campanha educativa (Marketing)":
    "Template Meta de MARKETING que convida o destinatário a acessar conteúdo educativo sobre o cuidado",
  "Aviso do ambulatório (Utilidade)":
    "Template Meta de UTILIDADE para avisos operacionais curtos com botão de confirmação de leitura",
  "Campanha institucional (Marketing)":
    "Template Meta de MARKETING institucional para fortalecer vínculo e divulgar o serviço",
};

export function getTemplateDescription(name: string, fallback: string): string {
  return WHATSAPP_DESCRIPTIONS[name] ?? fallback;
}
