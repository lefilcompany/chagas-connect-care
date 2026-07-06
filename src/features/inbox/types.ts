export type InboxStatusFilter =
  | "todas"
  | "nao-lidas"
  | "aguardando-resposta"
  | "janela-aberta"
  | "janela-fechada"
  | "desconhecido";

export const inboxStatusLabels: Record<InboxStatusFilter, string> = {
  todas: "Todas",
  "nao-lidas": "Não lidas",
  "aguardando-resposta": "Aguardando resposta",
  "janela-aberta": "Janela ativa",
  "janela-fechada": "Janela encerrada",
  desconhecido: "Contato desconhecido",
};

export type InboxChannelFilter = "todos" | "whatsapp";

export const inboxChannelLabels: Record<InboxChannelFilter, string> = {
  todos: "Todos os canais",
  whatsapp: "WhatsApp",
};