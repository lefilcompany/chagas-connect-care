export type PersonRow = {
  id: string;
  full_name: string;
  stage: string | null;
  phone: string | null;
  channel_pref: string | null;
  city: string | null;
  state: string | null;
  status: string | null;
  birth_date: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string | null;
};

export type PersonDerived = {
  age: number | null;
  lastContactAt: string | null;
  lastMessageStatus: string | null;
  lastMessageFailed: boolean;
  pendingReply: boolean;
  contactsCount: number;
  hasCaregiver: boolean;
  hasConsent: boolean;
  hasValidChannel: boolean;
  pendencies: string[];
  nextActionKey: string | null;
};

export type PersonWithDerived = PersonRow & { derived: PersonDerived };

export type QuickFilter =
  | "todos"
  | "atencao"
  | "sem-contato"
  | "sem-consentimento"
  | "sem-canal"
  | "sem-cuidador"
  | "falha-envio";

export const quickFilterLabels: Record<QuickFilter, string> = {
  todos: "Todas as pessoas",
  atencao: "Precisa de atenção",
  "sem-contato": "Sem contato recente",
  "sem-consentimento": "Sem consentimento",
  "sem-canal": "Sem canal válido",
  "sem-cuidador": "Sem cuidador cadastrado",
  "falha-envio": "Última mensagem falhou",
};